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
    local acc = D.cachedAccounts[debtorAccountId]
    if not acc then return false end
    if acc.auth and acc.auth[cid] then return true end
    local jobs = GetJobs(Player)
    if type(jobs) == 'table' and jobs[1] then
        for k = 1, #jobs do
            if jobs[k].name == debtorAccountId and IsJobAuth(jobs[k].name, jobs[k].grade) then
                return true
            end
        end
    elseif type(jobs) == 'table' and jobs.name == debtorAccountId and IsJobAuth(jobs.name, jobs.grade) then
        return true
    end
    local gang = GetGang(Player)
    if gang and gang ~= 'none' and gang == debtorAccountId and IsGangAuth(Player, gang) then
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
    local ok, decoded = pcall(json.decode, r.metadata or '{}')
    r.metadata = (ok and type(decoded) == 'table') and decoded or {}
    return r
end

local function persistRow(r)
    MySQL.update.await(
        'UPDATE `bank_payment_instructions` SET `amount`=?, `interval_seconds`=?, `next_run_at`=?, `status`=?, `metadata`=?, `updated_at`=? WHERE `id`=?',
        {
            math.floor(r.amount),
            math.floor(r.interval_seconds),
            math.floor(r.next_run_at),
            r.status,
            metaJson(r.metadata),
            now(),
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
    }
    local ok, err = pcall(function()
        MySQL.query.await(
            'INSERT INTO `bank_payment_instructions` (`id`,`kind`,`debtor_account_id`,`creditor_target`,`amount`,`interval_seconds`,`next_run_at`,`status`,`metadata`,`created_at`,`updated_at`) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
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

local function runExecution(inst, overrideAmount)
    local amt = overrideAmount or computeDebitAmount(inst)
    amt = math.floor(tonumber(amt) or 0)
    if amt < 1 then return false, 'invalid_amount' end
    local comment = transferComment(inst)
    return D.executeAccountTransfer(inst.debtor_account_id, inst.creditor_target, amt, comment, {})
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
        return { success = true }
    elseif action == 'resume' then
        if inst.kind == 'subscription' and inst.metadata and inst.metadata.system_suspended then
            return { success = false, error = 'suspended' }
        end
        if inst.status ~= 'paused' then return { success = false, error = 'state' } end
        inst.status = 'active'
        inst.next_run_at = math.min(inst.next_run_at, now())
        inst.updated_at = now()
        persistRow(inst)
        return { success = true }
    elseif action == 'cancel' then
        inst.status = 'cancelled'
        inst.next_run_at = 0
        inst.updated_at = now()
        persistRow(inst)
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
    }
    if not insertRow(row) then return false, 'db' end
    cacheRow(row)
    return id
end
exports('create_standing_order', create_standing_order_export)

local function cancel_payment_instruction(instructionId)
    local inst = instructionsById[instructionId]
    if not inst then return false end
    inst.status = 'cancelled'
    inst.next_run_at = 0
    inst.updated_at = now()
    persistRow(inst)
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
