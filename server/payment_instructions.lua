assert(BankingDeps, 'BankingDeps missing — server/main.lua must load first')

local D = BankingDeps
local instructionsById = {}

local PI_MIN_INTERVAL = 60
local PI_RETRY_OFFLINE_PERSONAL = 300

local function now()
    return os.time()
end

local function deepCopyMeta(meta)
    if type(meta) ~= 'table' then return {} end
    local out = {}
    for k, v in pairs(meta) do
        out[k] = v
    end
    return out
end

local function metaJson(meta)
    local ok, enc = pcall(json.encode, type(meta) == 'table' and meta or {})
    return ok and enc or '{}'
end

--- Strip values ox_lib/msgpack cannot serialize (e.g. cjson.null userdata).
local function scrubForCallback(v, depth)
    depth = depth or 0
    if depth > 4 then return nil end
    local t = type(v)
    if t == 'string' or t == 'number' or t == 'boolean' then return v end
    if t ~= 'table' then return nil end
    local o = {}
    for k, val in pairs(v) do
        local ks = type(k) == 'string' and k or tostring(k)
        local vt = type(val)
        if vt == 'string' or vt == 'number' or vt == 'boolean' then
            o[ks] = val
        elseif vt == 'table' then
            local inner = scrubForCallback(val, depth + 1)
            if inner and next(inner) then o[ks] = inner end
        end
    end
    return o
end

local function bankIdString(v)
    if v == nil then return nil end
    if type(v) == 'string' then return v end
    return tostring(v)
end

--- Player may debit / manage schedules on this banking id (personal, job, gang, shared).
local function canManageDebtorAccount(source, debtorAccountId)
    if not source or not debtorAccountId then return false end
    local Player = GetPlayerObject(source)
    if not Player then return false end
    local cid = GetIdentifier(Player)
    if debtorAccountId == cid then return true end
    --- Card-only shared accounts with PIN need an active PIN session; PI setup may require unlocking the bank UI first.
    if D.canUseCachedAccountForBanking and D.canUseCachedAccountForBanking(source, debtorAccountId) then
        return true
    end
    return false
end

local function rowFromDb(r)
    if type(r) ~= 'table' or not r.id then return nil end
    r.amount = tonumber(r.amount) or 0
    r.interval_seconds = tonumber(r.interval_seconds) or 0
    r.next_run_at = tonumber(r.next_run_at) or 0
    r.created_at = tonumber(r.created_at) or 0
    r.updated_at = tonumber(r.updated_at) or 0
    r.owner_resource = type(r.owner_resource) == 'string' and r.owner_resource or ''
    r.external_id = type(r.external_id) == 'string' and r.external_id or ''
    r.subscription_internal_id = r.subscription_internal_id ~= nil and tonumber(r.subscription_internal_id) or nil
    local ok, decoded = pcall(json.decode, r.metadata or '{}')
    r.metadata = (ok and type(decoded) == 'table') and decoded or {}
    return r
end

local function persistRow(r)
    MySQL.update.await(
        'UPDATE `bank_payment_instructions` SET `amount`=?, `interval_seconds`=?, `next_run_at`=?, `status`=?, `metadata`=?, `updated_at`=?, `owner_resource`=?, `external_id`=?, `subscription_internal_id`=? WHERE `id`=?',
        {
            math.floor(r.amount),
            math.floor(r.interval_seconds),
            math.floor(r.next_run_at),
            r.status,
            metaJson(r.metadata),
            now(),
            r.owner_resource or '',
            r.external_id or '',
            r.subscription_internal_id,
            r.id,
        }
    )
end

local function insertRow(r)
    local params = {
        r.id,
        r.kind,
        r.debtor_account_id,
        r.creditor_target,
        math.floor(r.amount),
        math.floor(r.interval_seconds),
        math.floor(r.next_run_at),
        r.status,
        metaJson(r.metadata),
        r.created_at,
        r.updated_at,
        r.owner_resource or '',
        r.external_id or '',
        r.subscription_internal_id,
    }
    local ok, err = pcall(function()
        MySQL.query.await(
            'INSERT INTO `bank_payment_instructions` (`id`,`kind`,`debtor_account_id`,`creditor_target`,`amount`,`interval_seconds`,`next_run_at`,`status`,`metadata`,`created_at`,`updated_at`,`owner_resource`,`external_id`,`subscription_internal_id`) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
            params
        )
    end)
    if ok then return true end
    print(('[krgsh_banking] bank_payment_instructions INSERT failed: %s'):format(tostring(err)))
    return false
end

local function cacheRow(r)
    instructionsById[r.id] = r
end

local function loadAllInstructions()
    instructionsById = {}
    local ok, rows = pcall(function()
        return MySQL.query.await('SELECT * FROM `bank_payment_instructions`', {})
    end)
    if not ok then
        print(('[krgsh_banking] bank_payment_instructions SELECT failed: %s'):format(tostring(rows)))
        return
    end
    if type(rows) ~= 'table' then return end
    for _, r in pairs(rows) do
        local row = rowFromDb(r)
        if row then cacheRow(row) end
    end
end

local function notifyDebtorsPending(inst)
    for _, sid in ipairs(GetPlayers()) do
        local src = tonumber(sid)
        if src and canManageDebtorAccount(src, inst.debtor_account_id) then
            TriggerClientEvent('krgsh_banking:client:pendingMandate', src, inst.id, inst.kind)
        end
    end
end

local function transferComment(inst)
    local label = inst.metadata and inst.metadata.label
    if type(label) == 'string' and label ~= '' then
        return D.sanitizeMessage(('[PI %s] %s'):format(inst.kind, label))
    end
    return locale('pi_transfer_prefix', '[Payment instruction]') .. inst.kind
end

local function computeDebitAmount(inst)
    local base = math.floor(tonumber(inst.amount) or 0)
    if inst.kind == 'installment' then
        local rem = tonumber(inst.metadata and inst.metadata.remaining_principal)
        if not rem or rem < 1 then return 0 end
        return math.min(base, math.floor(rem))
    end
    local cap = tonumber(inst.metadata and inst.metadata.max_debit_per_period)
    if cap and cap > 0 then
        return math.min(base, math.floor(cap))
    end
    return base
end

local function shouldRunScheduler(inst)
    if inst.status ~= 'active' then return false end
    if inst.kind == 'direct_debit' and (inst.interval_seconds or 0) < 1 then return false end
    if inst.kind == 'subscription' then
        if inst.metadata and inst.metadata.system_suspended then return false end
    end
    return true
end

local function advanceNextRun(inst, fromTs)
    local iv = math.floor(tonumber(inst.interval_seconds) or 0)
    if iv < 1 then return fromTs end
    return fromTs + iv
end

--- Subscription rows created via `createSubscription` export (numeric id + owner + external_id).
local function isApiSubscription(inst)
    return inst
        and inst.kind == 'subscription'
        and inst.subscription_internal_id ~= nil
        and tonumber(inst.subscription_internal_id) ~= nil
        and type(inst.owner_resource) == 'string'
        and inst.owner_resource ~= ''
        and type(inst.external_id) == 'string'
        and inst.external_id ~= ''
end

local function runExecution(inst, overrideAmount, xferOpts)
    local amt = overrideAmount or computeDebitAmount(inst)
    amt = math.floor(tonumber(amt) or 0)
    if amt < 1 then return false, 'invalid_amount' end
    local comment = transferComment(inst)
    return D.executeAccountTransfer(inst.debtor_account_id, inst.creditor_target, amt, comment, xferOpts or {})
end

local function subscriptionBookingBase(inst)
    local m = inst.metadata or {}
    if type(m.booking_title) == 'string' and m.booking_title ~= '' then
        return m.booking_title
    end
    if type(m.label) == 'string' and m.label ~= '' then
        return m.label
    end
    return 'Subscription'
end

local function triggerCannotPayEvent(inst, debitAmt, errCode)
    local m = inst.metadata or {}
    local pc = math.floor(tonumber(m.payments_completed) or 0)
    local maxpRaw = m.max_payments
    local maxp = (maxpRaw ~= nil) and math.floor(tonumber(maxpRaw) or 0) or nil
    local tsec = now()
    local processedAt = os.date('%Y-%m-%d %H:%M:%S', tsec)
    local base = subscriptionBookingBase(inst)
    local payload = {
        subscription_id = tonumber(inst.subscription_internal_id),
        instruction_id = inst.id,
        external_id = inst.external_id,
        owner_resource = inst.owner_resource,
        sender_account = inst.debtor_account_id,
        receiver_account = inst.creditor_target,
        amount = debitAmt,
        booking_title = base,
        booking_title_resolved = base,
        transaction_number = '',
        processed_at = processedAt,
        payments_completed = pc,
        max_payments = (maxp and maxp >= 1) and maxp or nil,
        is_final_payment = false,
        failure_reason = tostring(errCode or 'unknown'),
    }
    local ev = m.cannot_pay_event
    if type(ev) == 'string' and ev ~= '' then
        TriggerEvent(ev, payload)
    end
end

local function processApiSubscriptionDebit(inst, debitAmt)
    local m = inst.metadata or {}
    local bookingBase = subscriptionBookingBase(inst)
    local ok, err, det = runExecution(inst, debitAmt, {
        subscriptionBookingTitle = bookingBase,
        returnTransaction = true,
    })
    if not ok then
        triggerCannotPayEvent(inst, debitAmt, err)
        afterFailedDebit(inst, err)
        return
    end

    local pc = math.floor(tonumber(m.payments_completed) or 0)
    local maxpRaw = m.max_payments
    local maxp = (maxpRaw ~= nil) and math.floor(tonumber(maxpRaw) or 0) or nil
    local newPc = pc + 1
    local isFinal = maxp and maxp >= 1 and newPc >= maxp
    local tsec = now()
    local processedAt = os.date('%Y-%m-%d %H:%M:%S', tsec)

    local payload = {
        subscription_id = tonumber(inst.subscription_internal_id),
        instruction_id = inst.id,
        external_id = inst.external_id,
        owner_resource = inst.owner_resource,
        sender_account = inst.debtor_account_id,
        receiver_account = inst.creditor_target,
        amount = debitAmt,
        booking_title = det and det.booking_title or bookingBase,
        booking_title_resolved = det and det.booking_title_resolved or bookingBase,
        transaction_number = det and det.transaction_number or '',
        processed_at = processedAt,
        payments_completed = newPc,
        max_payments = (maxp and maxp >= 1) and maxp or nil,
        is_final_payment = isFinal and true or false,
    }

    local evPay = m.payment_processed_event
    if type(evPay) == 'string' and evPay ~= '' then
        TriggerEvent(evPay, payload)
    end

    if isFinal then
        local fe = m.finished_payments_event
        if type(fe) == 'string' and fe ~= '' then
            local fp = {}
            for k, v in pairs(payload) do
                fp[k] = v
            end
            fp.finished_at = processedAt
            TriggerEvent(fe, fp)
        end
    end

    m.payments_completed = newPc
    inst.metadata = m
    if isFinal then
        inst.status = 'completed'
        inst.next_run_at = 0
    else
        inst.next_run_at = advanceNextRun(inst, tsec)
    end
    inst.updated_at = tsec
    persistRow(inst)
end

local function fireSubscriptionPausedEvent(inst)
    if not isApiSubscription(inst) then return end
    local m = inst.metadata or {}
    local ev = m.subscription_paused_event
    if type(ev) ~= 'string' or ev == '' then return end
    local tsec = now()
    local payload = {
        subscription_id = tonumber(inst.subscription_internal_id),
        instruction_id = inst.id,
        external_id = inst.external_id,
        owner_resource = inst.owner_resource,
        sender_account = inst.debtor_account_id,
        receiver_account = inst.creditor_target,
        amount = math.floor(tonumber(inst.amount) or 0),
        user_can_cancel = m.user_can_cancel == true,
        paused_at = os.date('%Y-%m-%d %H:%M:%S', tsec),
    }
    TriggerEvent(ev, payload)
end

local function fireSubscriptionCancelledEvent(inst)
    if not isApiSubscription(inst) then return end
    local m = inst.metadata or {}
    local ev = m.cancel_subscription_event
    if type(ev) ~= 'string' or ev == '' then return end
    local tsec = now()
    local payload = {
        subscription_id = tonumber(inst.subscription_internal_id),
        instruction_id = inst.id,
        external_id = inst.external_id,
        owner_resource = inst.owner_resource,
        sender_account = inst.debtor_account_id,
        receiver_account = inst.creditor_target,
        amount = math.floor(tonumber(inst.amount) or 0),
        user_can_cancel = m.user_can_cancel == true,
        cancelled_at = os.date('%Y-%m-%d %H:%M:%S', tsec),
    }
    TriggerEvent(ev, payload)
end

local function afterSuccessfulDebit(inst, debitedAmount)
    local t = now()
    if inst.kind == 'installment' then
        local rem = math.floor(tonumber(inst.metadata.remaining_principal) or 0)
        rem = rem - debitedAmount
        inst.metadata.remaining_principal = math.max(0, rem)
        if rem <= 0 then
            inst.status = 'completed'
            inst.next_run_at = 0
            persistRow(inst)
            return
        end
    end
    inst.next_run_at = advanceNextRun(inst, t)
    inst.updated_at = t
    persistRow(inst)
end

local function afterFailedDebit(inst, err)
    local t = now()
    if err == 'debtor_offline_personal' then
        inst.next_run_at = t + PI_RETRY_OFFLINE_PERSONAL
    elseif err == 'insufficient_funds' then
        inst.next_run_at = advanceNextRun(inst, t)
    else
        inst.next_run_at = t + PI_RETRY_OFFLINE_PERSONAL
    end
    inst.updated_at = t
    persistRow(inst)
end

local function processInstructionTick(inst)
    if not shouldRunScheduler(inst) then return end
    if inst.next_run_at > now() then return end

    local debitAmt = computeDebitAmount(inst)
    if debitAmt < 1 then
        if inst.kind == 'installment' then
            inst.status = 'completed'
            inst.next_run_at = 0
            persistRow(inst)
        end
        return
    end

    if isApiSubscription(inst) then
        processApiSubscriptionDebit(inst, debitAmt)
        return
    end

    local ok, err = runExecution(inst, debitAmt)
    if ok then
        afterSuccessfulDebit(inst, debitAmt)
    else
        afterFailedDebit(inst, err)
    end
end

CreateThread(function()
    Wait(2000)
    loadAllInstructions()
end)

CreateThread(function()
    while true do
        Wait(60000)
        for _, inst in pairs(instructionsById) do
            processInstructionTick(inst)
        end
    end
end)

local function newInstructionId()
    if type(D.genTransactionID) == 'function' then
        return D.genTransactionID()
    end
    return ('pi-%x-%x'):format(os.time(), math.random(0x100000, 0xFFFFFFF))
end

local function canResourceCreateSubscription()
    local inv = GetInvokingResource() or ''
    local list = Config.paymentInstructionsTrustedResources
    if type(list) ~= 'table' or #list == 0 then
        return inv == GetCurrentResourceName()
    end
    for i = 1, #list do
        if list[i] == inv then return true end
    end
    return false
end

local function validateAccounts(debtorId, creditorId)
    if type(debtorId) ~= 'string' or debtorId == '' then return false end
    if type(creditorId) ~= 'string' or creditorId == '' then return false end
    if debtorId == creditorId then return false end
    return true
end

--- Build list visible to player (debtor-side management + pending mandates).
local function listForSource(source)
    local out = {}
    for _, inst in pairs(instructionsById) do
        if canManageDebtorAccount(source, inst.debtor_account_id) then
            local ser = {
                id = inst.id,
                kind = inst.kind,
                debtor_account_id = inst.debtor_account_id,
                creditor_target = inst.creditor_target,
                amount = inst.amount,
                interval_seconds = inst.interval_seconds,
                next_run_at = inst.next_run_at,
                status = inst.status,
                metadata = scrubForCallback(deepCopyMeta(inst.metadata)) or {},
                created_at = inst.created_at,
                updated_at = inst.updated_at,
                owner_resource = inst.owner_resource,
                external_id = inst.external_id,
                subscription_internal_id = inst.subscription_internal_id,
            }
            out[#out + 1] = ser
        end
    end
    table.sort(out, function(a, b)
        return (tonumber(a.created_at) or 0) > (tonumber(b.created_at) or 0)
    end)
    return out
end

lib.callback.register('krgsh_banking:server:listPaymentInstructions', function(source, data)
    data = type(data) == 'table' and data or {}
    if data.atm then return {} end
    local ok, result = pcall(listForSource, source)
    if not ok then
        print(('[krgsh_banking] listPaymentInstructions error: %s'):format(tostring(result)))
        return {}
    end
    return result
end)

lib.callback.register('krgsh_banking:server:createStandingOrder', function(source, data)
    data = type(data) == 'table' and data or {}
    if data.atm then return { success = false, error = 'atm' } end
    local debtor = bankIdString(data.debtorAccountId)
    local creditor = bankIdString(data.creditorTarget)
    if debtor then debtor = debtor:gsub('^%s+', ''):gsub('%s+$', '') end
    if creditor then creditor = creditor:gsub('^%s+', ''):gsub('%s+$', '') end
    local amount = math.floor(tonumber(data.amount) or 0)
    local interval = math.floor(tonumber(data.intervalSeconds) or 0)
    if not validateAccounts(debtor, creditor) or amount < 1 or interval < PI_MIN_INTERVAL then
        return { success = false, error = 'invalid' }
    end
    if not canManageDebtorAccount(source, debtor) then return { success = false, error = 'auth' } end

    local t = now()
    local meta = { label = type(data.label) == 'string' and string.sub(data.label, 1, 200) or '' }
    local id = newInstructionId()
    local row = {
        id = id,
        kind = 'standing_order',
        debtor_account_id = debtor,
        creditor_target = creditor,
        amount = amount,
        interval_seconds = interval,
        next_run_at = t,
        status = 'active',
        metadata = meta,
        created_at = t,
        updated_at = t,
        owner_resource = '',
        external_id = '',
        subscription_internal_id = nil,
    }
    if not insertRow(row) then
        return { success = false, error = 'db' }
    end
    cacheRow(row)
    return { success = true, id = id }
end)

lib.callback.register('krgsh_banking:server:updatePaymentInstruction', function(source, data)
    if type(data) == 'table' and data.atm then return { success = false, error = 'atm' } end
    local id = data and data.id
    local action = data and data.action
    local inst = id and instructionsById[id]
    if not inst then return { success = false, error = 'missing' } end
    if not canManageDebtorAccount(source, inst.debtor_account_id) then return { success = false, error = 'auth' } end

    if action == 'pause' then
        if inst.kind == 'subscription' and inst.metadata and inst.metadata.system_suspended then
            return { success = false, error = 'suspended' }
        end
        if inst.status ~= 'active' then return { success = false, error = 'state' } end
        inst.status = 'paused'
        inst.updated_at = now()
        persistRow(inst)
        fireSubscriptionPausedEvent(inst)
        return { success = true }
    elseif action == 'resume' then
        if inst.kind == 'subscription' and inst.metadata and inst.metadata.system_suspended then
            return { success = false, error = 'suspended' }
        end
        if inst.status ~= 'paused' then return { success = false, error = 'state' } end
        inst.status = 'active'
        if isApiSubscription(inst) then
            inst.next_run_at = advanceNextRun(inst, now())
        else
            inst.next_run_at = math.min(inst.next_run_at, now())
        end
        inst.updated_at = now()
        persistRow(inst)
        return { success = true }
    elseif action == 'cancel' then
        if inst.status == 'completed' or inst.status == 'cancelled' or inst.status == 'declined' then
            return { success = false, error = 'state' }
        end
        inst.status = 'cancelled'
        inst.next_run_at = 0
        inst.updated_at = now()
        persistRow(inst)
        fireSubscriptionCancelledEvent(inst)
        return { success = true }
    end
    return { success = false, error = 'action' }
end)

lib.callback.register('krgsh_banking:server:respondMandate', function(source, data)
    if type(data) == 'table' and data.atm then return { success = false, error = 'atm' } end
    local id = data and data.id
    local accept = data and data.accept == true
    local inst = id and instructionsById[id]
    if not inst or inst.status ~= 'pending_debtor_confirm' then return { success = false, error = 'state' } end
    if not canManageDebtorAccount(source, inst.debtor_account_id) then return { success = false, error = 'auth' } end
    local t = now()
    inst.metadata = inst.metadata or {}
    if accept then
        inst.status = 'active'
        inst.next_run_at = t
        local Player = GetPlayerObject(source)
        if Player then
            inst.metadata.confirmed_by = GetIdentifier(Player)
        end
        inst.metadata.confirmed_at = t
    else
        inst.status = 'declined'
        inst.next_run_at = 0
    end
    inst.updated_at = t
    persistRow(inst)
    return { success = true }
end)

--- Exports for other resources
local function create_direct_debit_request(debtorId, creditorId, amount, intervalSeconds, metadata)
    if not validateAccounts(debtorId, creditorId) then return false, 'invalid_accounts' end
    amount = math.floor(tonumber(amount) or 0)
    if amount < 1 then return false, 'invalid_amount' end
    intervalSeconds = math.floor(tonumber(intervalSeconds) or 0)
    local t = now()
    local meta = deepCopyMeta(metadata)
    meta.initiator_resource = GetInvokingResource() or 'unknown'
    local id = newInstructionId()
    local row = {
        id = id,
        kind = 'direct_debit',
        debtor_account_id = debtorId,
        creditor_target = creditorId,
        amount = amount,
        interval_seconds = intervalSeconds,
        next_run_at = t,
        status = 'pending_debtor_confirm',
        metadata = meta,
        created_at = t,
        updated_at = t,
        owner_resource = '',
        external_id = '',
        subscription_internal_id = nil,
    }
    if not insertRow(row) then return false, 'db' end
    cacheRow(row)
    notifyDebtorsPending(row)
    return id
end
exports('create_direct_debit_request', create_direct_debit_request)

local function create_installment(debtorId, creditorId, installmentAmount, totalPrincipal, intervalSeconds, metadata)
    if not validateAccounts(debtorId, creditorId) then return false, 'invalid_accounts' end
    installmentAmount = math.floor(tonumber(installmentAmount) or 0)
    totalPrincipal = math.floor(tonumber(totalPrincipal) or 0)
    intervalSeconds = math.floor(tonumber(intervalSeconds) or 0)
    if installmentAmount < 1 or totalPrincipal < 1 or intervalSeconds < PI_MIN_INTERVAL then
        return false, 'invalid'
    end
    local t = now()
    local meta = deepCopyMeta(metadata)
    meta.initiator_resource = GetInvokingResource() or 'unknown'
    meta.remaining_principal = totalPrincipal
    local id = newInstructionId()
    local row = {
        id = id,
        kind = 'installment',
        debtor_account_id = debtorId,
        creditor_target = creditorId,
        amount = installmentAmount,
        interval_seconds = intervalSeconds,
        next_run_at = t,
        status = 'pending_debtor_confirm',
        metadata = meta,
        created_at = t,
        updated_at = t,
        owner_resource = '',
        external_id = '',
        subscription_internal_id = nil,
    }
    if not insertRow(row) then return false, 'db' end
    cacheRow(row)
    notifyDebtorsPending(row)
    return id
end
exports('create_installment', create_installment)

local function create_subscription(debtorId, creditorId, amount, intervalSeconds, metadata)
    if not canResourceCreateSubscription() then return false, 'untrusted' end
    if not validateAccounts(debtorId, creditorId) then return false, 'invalid_accounts' end
    amount = math.floor(tonumber(amount) or 0)
    intervalSeconds = math.floor(tonumber(intervalSeconds) or 0)
    if amount < 1 or intervalSeconds < PI_MIN_INTERVAL then return false, 'invalid' end
    local t = now()
    local meta = deepCopyMeta(metadata)
    meta.initiator_resource = GetInvokingResource() or 'unknown'
    local id = newInstructionId()
    local row = {
        id = id,
        kind = 'subscription',
        debtor_account_id = debtorId,
        creditor_target = creditorId,
        amount = amount,
        interval_seconds = intervalSeconds,
        next_run_at = t,
        status = 'active',
        metadata = meta,
        created_at = t,
        updated_at = t,
        owner_resource = '',
        external_id = '',
        subscription_internal_id = nil,
    }
    if not insertRow(row) then return false, 'db' end
    cacheRow(row)
    return id
end
exports('create_subscription', create_subscription)

local function create_standing_order_export(debtorId, creditorId, amount, intervalSeconds, metadata)
    if not validateAccounts(debtorId, creditorId) then return false, 'invalid_accounts' end
    amount = math.floor(tonumber(amount) or 0)
    intervalSeconds = math.floor(tonumber(intervalSeconds) or 0)
    if amount < 1 or intervalSeconds < PI_MIN_INTERVAL then return false, 'invalid' end
    local t = now()
    local meta = deepCopyMeta(metadata)
    meta.initiator_resource = GetInvokingResource() or 'unknown'
    local id = newInstructionId()
    local row = {
        id = id,
        kind = 'standing_order',
        debtor_account_id = debtorId,
        creditor_target = creditorId,
        amount = amount,
        interval_seconds = intervalSeconds,
        next_run_at = t,
        status = 'active',
        metadata = meta,
        created_at = t,
        updated_at = t,
        owner_resource = '',
        external_id = '',
        subscription_internal_id = nil,
    }
    if not insertRow(row) then return false, 'db' end
    cacheRow(row)
    return id
end
exports('create_standing_order', create_standing_order_export)

local function trimStr(s)
    if type(s) ~= 'string' then return '' end
    return (s:match('^%s*(.-)%s*$') or '')
end

local function nonEmptyTrimmed(s)
    local t = trimStr(s)
    return t ~= '' and t or nil
end

local function findByOwnerExternal(owner, ext)
    if not owner or not ext or ext == '' then return nil end
    for _, inst in pairs(instructionsById) do
        if inst.owner_resource == owner and inst.external_id == ext then
            return inst
        end
    end
    return nil
end

local function nextSubscriptionInternalId()
    local v = MySQL.scalar.await('SELECT COALESCE(MAX(subscription_internal_id), 0) + 1 FROM bank_payment_instructions')
    return tonumber(v) or 1
end

local function serializeSubscriptionRow(inst)
    if not inst then return nil end
    return {
        instruction_id = inst.id,
        subscription_id = inst.subscription_internal_id,
        kind = inst.kind,
        debtor_account_id = inst.debtor_account_id,
        creditor_target = inst.creditor_target,
        sender_account = inst.debtor_account_id,
        receiver_account = inst.creditor_target,
        amount = inst.amount,
        interval_seconds = inst.interval_seconds,
        next_run_at = inst.next_run_at,
        status = inst.status,
        owner_resource = inst.owner_resource,
        external_id = inst.external_id,
        metadata = scrubForCallback(deepCopyMeta(inst.metadata)) or {},
        created_at = inst.created_at,
        updated_at = inst.updated_at,
    }
end

local function validateFiniteSubscriptionMeta(m)
    local maxp = m.max_payments
    if maxp == nil then return true end
    maxp = math.floor(tonumber(maxp) or 0)
    if maxp < 1 then return false, 'invalid_max_payments' end
    local fin = m.finished_payments_event
    if type(fin) ~= 'string' or trimStr(fin) == '' then
        return false, 'finished_event_required'
    end
    return true
end

--- Table-based subscription API (`subscription_id` = numeric `subscription_internal_id`).
local function createSubscription(data)
    if not canResourceCreateSubscription() then return nil, 'untrusted' end
    data = type(data) == 'table' and data or {}
    local owner = GetInvokingResource() or ''
    local ext = nonEmptyTrimmed(data.external_id)
    if not ext then return nil, 'invalid_external_id' end
    if findByOwnerExternal(owner, ext) then return nil, 'duplicate_external_id' end

    local sender = nonEmptyTrimmed(data.sender_account) or nonEmptyTrimmed(data.debtor_account_id)
    local receiver = nonEmptyTrimmed(data.receiver_account) or nonEmptyTrimmed(data.creditor_target)
    if not validateAccounts(sender, receiver) then return nil, 'invalid_accounts' end

    local amount = math.floor(tonumber(data.amount) or 0)
    local sched = type(data.schedule) == 'table' and data.schedule or {}
    local intervalSeconds = math.floor(tonumber(sched.interval_seconds) or 0)
    if amount < 1 or intervalSeconds < PI_MIN_INTERVAL then return nil, 'invalid' end

    if not nonEmptyTrimmed(data.payment_processed_event) then return nil, 'invalid_events' end
    if not nonEmptyTrimmed(data.cancel_subscription_event) then return nil, 'invalid_events' end
    if not nonEmptyTrimmed(data.cannot_pay_event) then return nil, 'invalid_events' end

    local meta = {}
    meta.booking_title = type(data.booking_title) == 'string' and string.sub(trimStr(data.booking_title), 1, 200) or ''
    meta.user_can_cancel = data.user_can_cancel == true
    meta.payments_completed = 0
    meta.payment_processed_event = trimStr(data.payment_processed_event)
    meta.cancel_subscription_event = trimStr(data.cancel_subscription_event)
    meta.cannot_pay_event = trimStr(data.cannot_pay_event)
    meta.finished_payments_event = type(data.finished_payments_event) == 'string' and trimStr(data.finished_payments_event) or ''
    meta.subscription_paused_event = type(data.subscription_paused_event) == 'string' and trimStr(data.subscription_paused_event) or ''
    if data.max_payments ~= nil then
        meta.max_payments = math.floor(tonumber(data.max_payments) or 0)
    end
    local okMeta, errMeta = validateFiniteSubscriptionMeta(meta)
    if not okMeta then return nil, errMeta end

    meta.initiator_resource = owner
    meta.label = meta.booking_title ~= '' and meta.booking_title or 'Subscription'

    local subIntId = nextSubscriptionInternalId()
    local t = now()
    local id = newInstructionId()
    local row = {
        id = id,
        kind = 'subscription',
        debtor_account_id = sender,
        creditor_target = receiver,
        amount = amount,
        interval_seconds = intervalSeconds,
        next_run_at = t,
        status = 'active',
        metadata = meta,
        created_at = t,
        updated_at = t,
        owner_resource = owner,
        external_id = ext,
        subscription_internal_id = subIntId,
    }
    if not insertRow(row) then return nil, 'db' end
    cacheRow(row)
    return subIntId, nil
end
exports('createSubscription', createSubscription)

local function assertOwnerSubscription(inst, owner)
    if not inst or inst.kind ~= 'subscription' then return false, 'not_found' end
    if inst.owner_resource ~= owner then return false, 'forbidden' end
    if not isApiSubscription(inst) then return false, 'legacy_subscription' end
    return true, nil
end

local function updateSubscription(externalId, patch)
    if not canResourceCreateSubscription() then return false, 'untrusted' end
    local owner = GetInvokingResource() or ''
    local ext = nonEmptyTrimmed(externalId)
    if not ext then return false, 'invalid_external_id' end
    local inst = findByOwnerExternal(owner, ext)
    local ok, err = assertOwnerSubscription(inst, owner)
    if not ok then return false, err end
    if inst.status == 'completed' then return false, 'completed' end

    patch = type(patch) == 'table' and patch or {}
    local m = deepCopyMeta(inst.metadata)

    if patch.sender_account ~= nil or patch.debtor_account_id ~= nil then
        local s = nonEmptyTrimmed(patch.sender_account) or nonEmptyTrimmed(patch.debtor_account_id)
        if s then inst.debtor_account_id = s end
    end
    if patch.receiver_account ~= nil or patch.creditor_target ~= nil then
        local r = nonEmptyTrimmed(patch.receiver_account) or nonEmptyTrimmed(patch.creditor_target)
        if r then inst.creditor_target = r end
    end
    if not validateAccounts(inst.debtor_account_id, inst.creditor_target) then return false, 'invalid_accounts' end

    if patch.amount ~= nil then
        local a = math.floor(tonumber(patch.amount) or 0)
        if a < 1 then return false, 'invalid' end
        inst.amount = a
    end

    if patch.booking_title ~= nil and type(patch.booking_title) == 'string' then
        m.booking_title = string.sub(trimStr(patch.booking_title), 1, 200)
        m.label = m.booking_title ~= '' and m.booking_title or 'Subscription'
    end

    if patch.schedule ~= nil and type(patch.schedule) == 'table' and patch.schedule.interval_seconds ~= nil then
        local iv = math.floor(tonumber(patch.schedule.interval_seconds) or 0)
        if iv < PI_MIN_INTERVAL then return false, 'invalid' end
        inst.interval_seconds = iv
        inst.next_run_at = advanceNextRun(inst, now())
    end

    if patch.user_can_cancel ~= nil then
        m.user_can_cancel = patch.user_can_cancel == true
    end

    if patch.payment_processed_event ~= nil then
        m.payment_processed_event = type(patch.payment_processed_event) == 'string' and trimStr(patch.payment_processed_event) or m.payment_processed_event
    end
    if patch.cancel_subscription_event ~= nil then
        m.cancel_subscription_event = type(patch.cancel_subscription_event) == 'string' and trimStr(patch.cancel_subscription_event) or m.cancel_subscription_event
    end
    if patch.cannot_pay_event ~= nil then
        m.cannot_pay_event = type(patch.cannot_pay_event) == 'string' and trimStr(patch.cannot_pay_event) or m.cannot_pay_event
    end
    if patch.finished_payments_event ~= nil then
        m.finished_payments_event = type(patch.finished_payments_event) == 'string' and trimStr(patch.finished_payments_event) or ''
    end
    if patch.subscription_paused_event ~= nil then
        m.subscription_paused_event = type(patch.subscription_paused_event) == 'string' and trimStr(patch.subscription_paused_event) or ''
    end

    if rawget(patch, 'max_payments') ~= nil then
        if patch.max_payments == false then
            m.max_payments = nil
        else
            m.max_payments = math.floor(tonumber(patch.max_payments) or 0)
        end
    end

    local pc = math.floor(tonumber(m.payments_completed) or 0)
    local maxp = m.max_payments
    if maxp ~= nil then
        maxp = math.floor(tonumber(maxp) or 0)
        if maxp < 1 then return false, 'invalid_max_payments' end
        if maxp < pc then return false, 'max_below_completed' end
    end

    local okM, errM = validateFiniteSubscriptionMeta(m)
    if not okM then return false, errM end

    if not nonEmptyTrimmed(m.payment_processed_event) or not nonEmptyTrimmed(m.cancel_subscription_event) or not nonEmptyTrimmed(m.cannot_pay_event) then
        return false, 'invalid_events'
    end

    inst.metadata = m
    inst.updated_at = now()
    persistRow(inst)
    return true, nil
end
exports('updateSubscription', updateSubscription)

local function pauseSubscription(externalId)
    if not canResourceCreateSubscription() then return false, 'untrusted' end
    local owner = GetInvokingResource() or ''
    local ext = nonEmptyTrimmed(externalId)
    if not ext then return false, 'invalid_external_id' end
    local inst = findByOwnerExternal(owner, ext)
    local ok, err = assertOwnerSubscription(inst, owner)
    if not ok then return false, err end
    if inst.status == 'completed' or inst.status == 'cancelled' or inst.status == 'declined' then
        return false, 'state'
    end
    if inst.metadata and inst.metadata.system_suspended then return false, 'suspended' end
    if inst.status ~= 'active' then return false, 'state' end
    inst.status = 'paused'
    inst.updated_at = now()
    persistRow(inst)
    fireSubscriptionPausedEvent(inst)
    return true, nil
end
exports('pauseSubscription', pauseSubscription)

local function resumeSubscription(externalId)
    if not canResourceCreateSubscription() then return false, 'untrusted' end
    local owner = GetInvokingResource() or ''
    local ext = nonEmptyTrimmed(externalId)
    if not ext then return false, 'invalid_external_id' end
    local inst = findByOwnerExternal(owner, ext)
    local ok, err = assertOwnerSubscription(inst, owner)
    if not ok then return false, err end
    if inst.status == 'completed' or inst.status == 'cancelled' or inst.status == 'declined' then
        return false, 'state'
    end
    if inst.metadata and inst.metadata.system_suspended then return false, 'suspended' end
    if inst.status ~= 'paused' then return false, 'state' end
    inst.status = 'active'
    inst.next_run_at = advanceNextRun(inst, now())
    inst.updated_at = now()
    persistRow(inst)
    return true, nil
end
exports('resumeSubscription', resumeSubscription)

local function cancelSubscription(externalId)
    if not canResourceCreateSubscription() then return false, 'untrusted' end
    local owner = GetInvokingResource() or ''
    local ext = nonEmptyTrimmed(externalId)
    if not ext then return false, 'invalid_external_id' end
    local inst = findByOwnerExternal(owner, ext)
    local ok, err = assertOwnerSubscription(inst, owner)
    if not ok then return false, err end
    if inst.status == 'completed' or inst.status == 'cancelled' or inst.status == 'declined' then
        return false, 'state'
    end
    inst.status = 'cancelled'
    inst.next_run_at = 0
    inst.updated_at = now()
    persistRow(inst)
    fireSubscriptionCancelledEvent(inst)
    return true, nil
end
exports('cancelSubscription', cancelSubscription)

local function getSubscriptionByExternalId(externalId)
    if not canResourceCreateSubscription() then return nil, 'untrusted' end
    local owner = GetInvokingResource() or ''
    local ext = nonEmptyTrimmed(externalId)
    if not ext then return nil, 'invalid_external_id' end
    local inst = findByOwnerExternal(owner, ext)
    local ok, err = assertOwnerSubscription(inst, owner)
    if not ok then return nil, err end
    return serializeSubscriptionRow(inst), nil
end
exports('getSubscriptionByExternalId', getSubscriptionByExternalId)

local function listSubscriptions()
    if not canResourceCreateSubscription() then return {}, 'untrusted' end
    local owner = GetInvokingResource() or ''
    local out = {}
    for _, inst in pairs(instructionsById) do
        if inst.kind == 'subscription' and inst.owner_resource == owner and isApiSubscription(inst) then
            out[#out + 1] = serializeSubscriptionRow(inst)
        end
    end
    table.sort(out, function(a, b)
        return (tonumber(a.subscription_id) or 0) > (tonumber(b.subscription_id) or 0)
    end)
    return out, nil
end
exports('listSubscriptions', listSubscriptions)

local function isSubscriptionActive(externalId)
    if not canResourceCreateSubscription() then return false end
    local owner = GetInvokingResource() or ''
    local ext = nonEmptyTrimmed(externalId)
    if not ext then return false end
    local inst = findByOwnerExternal(owner, ext)
    if not isApiSubscription(inst) or inst.owner_resource ~= owner then return false end
    if inst.status ~= 'active' then return false end
    if inst.metadata and inst.metadata.system_suspended then return false end
    return shouldRunScheduler(inst)
end
exports('isSubscriptionActive', isSubscriptionActive)

local function findActiveSubscription(senderAccount, receiverAccount, externalIdOpt)
    if not canResourceCreateSubscription() then return nil, 'untrusted' end
    local owner = GetInvokingResource() or ''
    local s = nonEmptyTrimmed(senderAccount)
    local r = nonEmptyTrimmed(receiverAccount)
    if not s or not r then return nil, 'invalid_accounts' end
    local wantExt = externalIdOpt and nonEmptyTrimmed(externalIdOpt)
    for _, inst in pairs(instructionsById) do
        if inst.kind == 'subscription' and inst.owner_resource == owner and isApiSubscription(inst) then
            if inst.debtor_account_id == s and inst.creditor_target == r then
                if not wantExt or inst.external_id == wantExt then
                    if inst.status == 'active' and (not inst.metadata or not inst.metadata.system_suspended) then
                        return serializeSubscriptionRow(inst), nil
                    end
                end
            end
        end
    end
    return nil, nil
end
exports('findActiveSubscription', findActiveSubscription)

local function cancel_payment_instruction(instructionId)
    local inst = instructionsById[instructionId]
    if not inst then return false end
    if inst.status == 'completed' or inst.status == 'cancelled' or inst.status == 'declined' then return false end
    inst.status = 'cancelled'
    inst.next_run_at = 0
    inst.updated_at = now()
    persistRow(inst)
    fireSubscriptionCancelledEvent(inst)
    return true
end
exports('cancel_payment_instruction', cancel_payment_instruction)

local function suspend_subscription_system(instructionId, flag)
    local inst = instructionsById[instructionId]
    if not inst or inst.kind ~= 'subscription' then return false end
    if not canResourceCreateSubscription() then return false end
    inst.metadata = inst.metadata or {}
    inst.metadata.system_suspended = flag and true or nil
    inst.updated_at = now()
    persistRow(inst)
    return true
end
exports('suspend_subscription_system', suspend_subscription_system)

local function trigger_direct_debit(instructionId, debitAmount)
    local inst = instructionsById[instructionId]
    if not inst or inst.kind ~= 'direct_debit' then return false, 'invalid' end
    if inst.status ~= 'active' then return false, 'state' end
    local amt = debitAmount and math.floor(tonumber(debitAmount) or 0) or computeDebitAmount(inst)
    if amt < 1 then return false, 'amount' end
    local ok, err = runExecution(inst, amt)
    if not ok then return false, err end
    local t = now()
    if (inst.interval_seconds or 0) >= 1 then
        inst.next_run_at = advanceNextRun(inst, t)
    end
    inst.updated_at = t
    persistRow(inst)
    return true
end
exports('trigger_direct_debit', trigger_direct_debit)
