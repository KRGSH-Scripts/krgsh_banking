local cachedAccounts = {}
local cachedPlayers = {}
local createSharedCooldown = {}

--- Deterministic numeric string of length `targetLen` for org/job display numbers.
local function formatSyntheticNumber(internalId, targetLen)
    targetLen = math.min(math.max(tonumber(targetLen) or 8, 1), 20)
    if not internalId then
        return string.rep('0', targetLen)
    end
    local s = tostring(internalId)
    local h = 5381
    for i = 1, #s do
        h = (h * 33 + string.byte(s, i)) % 2147483647
    end
    local digits = {}
    for i = 1, targetLen do
        h = (h * 1103515245 + 12345) % 2147483647
        digits[i] = tostring(h % 10)
    end
    return table.concat(digits)
end

local function personalIdLen(cid)
    local n = utf8.len(cid)
    if not n or n < 1 then
        n = #tostring(cid or '')
    end
    return math.min(math.max(n, 8), 20)
end

local function accountNumberForEntry(account, cid, lenNonPersonal)
    if account.id == cid then
        return account.id
    end
    if account.creator ~= nil then
        return account.id
    end
    return formatSyntheticNumber(account.id, lenNonPersonal)
end

local function cloneAccountForBankData(account, cid, lenNonPersonal)
    local out = {}
    for k, v in pairs(account) do
        out[k] = v
    end
    out.accountNumber = accountNumberForEntry(account, cid, lenNonPersonal)
    return out
end

CreateThread(function()
    Wait(500)
    local resourceName = GetCurrentResourceName()
    if not LoadResourceFile(resourceName, 'web/public/index.html') then
        error(locale("ui_not_built"))
        return StopResource(resourceName)
    end
    local accounts = MySQL.query.await('SELECT * FROM bank_accounts_new', {})
    if accounts then
        for _,v in pairs (accounts) do
            local job = v.id
            v.auth = json.decode(v.auth)
            local disp = v.display_label
            local resolvedName = (type(disp) == 'string' and disp ~= '') and disp or GetSocietyLabel(job)
            cachedAccounts[job] = { --  cachedAccounts[#cachedAccounts+1]
                id = job,
                type = locale("org"),
                name = resolvedName,
                display_label = (type(disp) == 'string' and disp ~= '') and disp or nil,
                frozen = v.isFrozen == 1,
                amount = v.amount,
                transactions = json.decode(v.transactions),
                auth = {},
                creator = v.creator
            }
            if #v.auth >= 1 then
                for k=1, #v.auth do
                    cachedAccounts[job].auth[v.auth[k]] = true
                end
            end
        end
    end
    local jobs, gangs = GetFrameworkGroups()
    local query = {}
    local function addCachedAccount(group)
        cachedAccounts[group] = {
            id = group,
            type = locale('org'),
            name = GetSocietyLabel(group),
            display_label = nil,
            frozen = 0,
            amount = 0,
            transactions = {},
            auth = {},
            creator = nil
        }
        query[#query + 1] = {"INSERT INTO bank_accounts_new (id, amount, transactions, auth, isFrozen, creator, display_label) VALUES (?, ?, ?, ?, ?, NULL, NULL) ",
        { group, cachedAccounts[group].amount, json.encode(cachedAccounts[group].transactions), json.encode({}), cachedAccounts[group].frozen }}
    end
    for job in pairs(jobs) do
        if not cachedAccounts[job] then
            addCachedAccount(job)
        end
    end
    for gang in pairs(gangs) do
        if not cachedAccounts[gang] then
            addCachedAccount(gang)
        end
    end
    if #query >= 1 then
        MySQL.transaction.await(query)
    end
end)

function UpdatePlayerAccount(cid)
    local p = promise.new()
    MySQL.query('SELECT * FROM player_transactions WHERE id = ?', {cid}, function(account)
        local query = '%' .. cid .. '%'
        MySQL.query("SELECT * FROM bank_accounts_new WHERE auth LIKE ? ", {query}, function(shared)
            cachedPlayers[cid] = {
                isFrozen = 0,
                transactions = #account > 0 and json.decode(account[1].transactions) or {},
                accounts = {}
            }

            if #shared >= 1 then
                for k=1, #shared do
                    cachedPlayers[cid].accounts[#cachedPlayers[cid].accounts+1] = shared[k].id
                end
            end
            p:resolve(true)
        end)
    end)
	return Citizen.Await(p)
end

local function getBankData(source)
    local Player = GetPlayerObject(source)
    local bankData = {}
    local cid = GetIdentifier(Player)
    if not cachedPlayers[cid] then UpdatePlayerAccount(cid) end
    local funds = GetFunds(Player)
    local plen = personalIdLen(cid)
    bankData[#bankData+1] = {
        id = cid,
        type = locale("personal"),
        name = GetCharacterName(Player),
        frozen = cachedPlayers[cid].isFrozen,
        amount = funds.bank,
        cash = funds.cash,
        transactions = cachedPlayers[cid].transactions,
        accountNumber = cid,
    }

    local jobs = GetJobs(Player)
    if #jobs > 0 then
        for k=1, #jobs do
            if cachedAccounts[jobs[k].name] and IsJobAuth(jobs[k].name, jobs[k].grade) then
                bankData[#bankData+1] = cloneAccountForBankData(cachedAccounts[jobs[k].name], cid, plen)
            end
        end
    else
        local job = cachedAccounts[jobs.name]
        if job and IsJobAuth(jobs.name, jobs.grade) then
            bankData[#bankData+1] = cloneAccountForBankData(job, cid, plen)
        end
    end

    local gang = GetGang(Player)
    if gang and gang ~= 'none' then
        local gangData = cachedAccounts[gang]
        if gangData and IsGangAuth(Player, gang) then
            bankData[#bankData+1] = cloneAccountForBankData(gangData, cid, plen)
        end
    end

    local sharedAccounts = cachedPlayers[cid].accounts
    for k=1, #sharedAccounts do
        local sAccount = cachedAccounts[sharedAccounts[k]]
        if sAccount then
            bankData[#bankData+1] = cloneAccountForBankData(sAccount, cid, plen)
        end
    end

    return bankData
end

lib.callback.register('krgsh_banking:server:initalizeBanking', function(source)
    local bankData = getBankData(source)
    return bankData
end)

-- Events
local function genTransactionID()
    local template ='xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'
    return string.gsub(template, '[xy]', function (c)
        local v = (c == 'x') and math.random(0, 0xf) or math.random(8, 0xb)
        return string.format('%x', v)
    end)
end

local function sanitizeMessage(message)
    if type(message) ~= "string" then
        message = tostring(message)
    end
    message = message:gsub("'", "''"):gsub("\\", "\\\\")
    return message
end

local Type = type
local function handleTransaction(account, title, amount, message, issuer, receiver, transType, transID)
    if not account or Type(account) ~= 'string' then return print(locale("err_trans_account", account)) end
    if not title or Type(title) ~= 'string' then return print(locale("err_trans_title", title)) end
    if not amount or Type(amount) ~= 'number' then return print(locale("err_trans_amount", amount)) end
    if not message or Type(message) ~= 'string' then return print(locale("err_trans_message", message)) end
    if not issuer or Type(issuer) ~= 'string' then return print(locale("err_trans_issuer", issuer)) end
    if not receiver or Type(receiver) ~= 'string' then return print(locale("err_trans_receiver", receiver)) end
    if not transType or Type(transType) ~= 'string' then return print(locale("err_trans_type", transType)) end
    if transID and Type(transID) ~= 'string' then return print(locale("err_trans_transID", transID)) end

    local transaction = {
        trans_id = transID or genTransactionID(),
        title = title,
        amount = amount,
        trans_type = transType,
        receiver = receiver,
        message = sanitizeMessage(message),
        issuer = issuer,
        time = os.time()
    }
    if cachedAccounts[account] then
        table.insert(cachedAccounts[account].transactions, 1, transaction)
        local transactions = json.encode(cachedAccounts[account].transactions)
        MySQL.prepare("INSERT INTO bank_accounts_new (id, transactions) VALUES (?, ?) ON DUPLICATE KEY UPDATE transactions = ?",{
            account, transactions, transactions
        })
    elseif cachedPlayers[account] then
        table.insert(cachedPlayers[account].transactions, 1, transaction)
        local transactions = json.encode(cachedPlayers[account].transactions)
        MySQL.prepare("INSERT INTO player_transactions (id, transactions) VALUES (?, ?) ON DUPLICATE KEY UPDATE transactions = ?", {
            account, transactions, transactions
        })
    else
        print(locale("invalid_account", account))
    end
    return transaction
end exports("handleTransaction", handleTransaction)

function GetAccountMoney(account)
    if not cachedAccounts[account] then
        locale("invalid_account", account)
        return false
    end
    return cachedAccounts[account].amount
end
exports('getAccountMoney', GetAccountMoney)

local function updateBalance(account)
    MySQL.prepare("UPDATE bank_accounts_new SET amount = ? WHERE id = ?",{ cachedAccounts[account].amount, account })
end

function AddAccountMoney(account, amount)
    if not cachedAccounts[account] then
        locale("invalid_account", account)
        return false
    end
    cachedAccounts[account].amount += amount
    updateBalance(account)
    return true
end
exports('addAccountMoney', AddAccountMoney)

local function getPlayerData(source, id)
    local Player = source and GetPlayerObject(source)
    if not Player then Player = GetPlayerObjectFromID(id) end
    if not Player then
        local msg = ("Cannot Find Account(%s)"):format(id)
        print(locale("invalid_account", id))
        if source then
            Notify(source, {title = locale("bank_name"), description = msg, type = "error"})
        end
    end
    return Player
end

--- Server-side transfer (no `source` required). Optional `opts.debtorPlayer` forces the debitor for personal accounts (NUI must pass the caller).
---@return boolean ok
---@return string? err insufficient_funds, creditor_offline, debtor_offline_personal, invalid_amount
local function executeAccountTransfer(fromAccount, stateid, amount, comment, opts)
    opts = opts or {}
    amount = math.floor(tonumber(amount) or 0)
    if amount < 1 then return false, 'invalid_amount' end
    if not comment or comment == '' then
        comment = locale('pi_default_comment')
    else
        comment = sanitizeMessage(comment)
    end

    if cachedAccounts[fromAccount] then
        if cachedAccounts[stateid] then
            if not RemoveAccountMoney(fromAccount, amount) then
                return false, 'insufficient_funds'
            end
            AddAccountMoney(stateid, amount)
            local title = ('%s / %s'):format(cachedAccounts[fromAccount].name, fromAccount)
            local transaction = handleTransaction(fromAccount, title, amount, comment, cachedAccounts[fromAccount].name, cachedAccounts[stateid].name, 'withdraw')
            handleTransaction(stateid, title, amount, comment, cachedAccounts[fromAccount].name, cachedAccounts[stateid].name, 'deposit', transaction.trans_id)
            return true
        end
        local Player2 = getPlayerData(false, stateid)
        if not Player2 then
            return false, 'creditor_offline'
        end
        if not RemoveAccountMoney(fromAccount, amount) then
            return false, 'insufficient_funds'
        end
        AddMoney(Player2, amount, 'bank', comment)
        local plyName = GetCharacterName(Player2)
        local title = ('%s / %s'):format(cachedAccounts[fromAccount].name, fromAccount)
        local transaction = handleTransaction(fromAccount, title, amount, comment, cachedAccounts[fromAccount].name, plyName, 'withdraw')
        handleTransaction(stateid, title, amount, comment, cachedAccounts[fromAccount].name, plyName, 'deposit', transaction.trans_id)
        return true
    end

    local Debtor = opts.debtorPlayer or GetPlayerObjectFromID(fromAccount)
    if not Debtor then
        return false, 'debtor_offline_personal'
    end
    local name = GetCharacterName(Debtor)
    local funds = GetFunds(Debtor)
    if cachedAccounts[stateid] then
        if funds.bank < amount or not RemoveMoney(Debtor, amount, 'bank', comment) then
            return false, 'insufficient_funds'
        end
        AddAccountMoney(stateid, amount)
        local transaction = handleTransaction(fromAccount, locale("personal_acc") .. fromAccount, amount, comment, name, cachedAccounts[stateid].name, "withdraw")
        handleTransaction(stateid, locale("personal_acc") .. fromAccount, amount, comment, name, cachedAccounts[stateid].name, "deposit", transaction.trans_id)
        return true
    end
    local Player2 = getPlayerData(false, stateid)
    if not Player2 then
        return false, 'creditor_offline'
    end
    if funds.bank < amount or not RemoveMoney(Debtor, amount, 'bank', comment) then
        return false, 'insufficient_funds'
    end
    local name2 = GetCharacterName(Player2)
    AddMoney(Player2, amount, 'bank', comment)
    local transaction = handleTransaction(fromAccount, locale("personal_acc") .. fromAccount, amount, comment, name, name2, "withdraw")
    handleTransaction(stateid, locale("personal_acc") .. fromAccount, amount, comment, name, name2, "deposit", transaction.trans_id)
    return true
end

lib.callback.register("krgsh_banking:server:deposit", function(source, data)
    local Player = GetPlayerObject(source)
    local amount = tonumber(data.amount)
    if not amount or amount < 1 then
        Notify(source, {title = locale("bank_name"), description = locale("invalid_amount", "deposit"), type = "error"})
        return false
    end
    local name = GetCharacterName(Player)
    if not data.comment or data.comment == "" then data.comment = locale("comp_transaction", name, "deposited", amount) else data.comment = sanitizeMessage(data.comment) end
    if RemoveMoney(Player, amount, 'cash', data.comment) then
        if cachedAccounts[data.fromAccount] then
            AddAccountMoney(data.fromAccount, amount)
        else
            AddMoney(Player, amount, 'bank', data.comment)
        end
        local Player2 = getPlayerData(source, data.fromAccount)
        Player2 = Player2 and GetCharacterName(Player2) or data.fromAccount
        handleTransaction(data.fromAccount, locale("personal_acc") .. data.fromAccount, amount, data.comment, name, Player2, "deposit")
        Notify(source, { title = locale("bank_name"), description = locale("notify_deposit_cash", tostring(amount)), type = "success" })
        local bankData = getBankData(source)
        return bankData
    else
        TriggerClientEvent('krgsh_banking:client:sendNotification', source, locale("not_enough_money"))
        return false
    end
end)

function RemoveAccountMoney(account, amount)
    if not cachedAccounts[account] then
        print(locale("invalid_account", account))
        return false
    end
    if cachedAccounts[account].amount < amount then
        print(locale("broke_account", account, amount))
        return false
    end

    cachedAccounts[account].amount -= amount
    updateBalance(account)
    return true
end
exports('removeAccountMoney', RemoveAccountMoney)

lib.callback.register('krgsh_banking:server:withdraw', function(source, data)
    local Player = GetPlayerObject(source)
    local amount = tonumber(data.amount)
    if not amount or amount < 1 then
        Notify(source, {title = locale("bank_name"), description = locale("invalid_amount", "withdraw"), type = "error"})
        return false
    end
    local name = GetCharacterName(Player)
    local funds = GetFunds(Player)
    if not data.comment or data.comment == "" then data.comment = locale("comp_transaction", name, "withdrawed", amount) else data.comment = sanitizeMessage(data.comment) end

    local canWithdraw
    if cachedAccounts[data.fromAccount] then
        canWithdraw = RemoveAccountMoney(data.fromAccount, amount)
    else
        canWithdraw = funds.bank >= amount and RemoveMoney(Player, amount, 'bank', data.comment) or false
    end
    if canWithdraw then
        local Player2 = getPlayerData(source, data.fromAccount)
        Player2 = Player2 and GetCharacterName(Player2) or data.fromAccount
        AddMoney(Player, amount, 'cash', data.comment)
        handleTransaction(data.fromAccount,locale("personal_acc") .. data.fromAccount, amount, data.comment, Player2, name, "withdraw")
        Notify(source, { title = locale("bank_name"), description = locale("notify_withdraw_cash", tostring(amount)), type = "success" })
        local bankData = getBankData(source)
        return bankData
    else
        TriggerClientEvent('krgsh_banking:client:sendNotification', source, locale("not_enough_money"))
        return false
    end
end)

lib.callback.register('krgsh_banking:server:transfer', function(source, data)
    local Player = GetPlayerObject(source)
    local amount = tonumber(data.amount)
    if not amount or amount < 1 then
        Notify(source, {title = locale("bank_name"), description = locale("invalid_amount", "transfer"), type = "error"})
        return false
    end
    local name = GetCharacterName(Player)
    if not data.comment or data.comment == "" then data.comment = locale("comp_transaction", name, "transfered", amount) else data.comment = sanitizeMessage(data.comment) end
    local opts = {}
    if not cachedAccounts[data.fromAccount] then
        opts.debtorPlayer = Player
    end
    local ok, err = executeAccountTransfer(data.fromAccount, data.stateid, amount, data.comment, opts)
    if not ok then
        if err == 'insufficient_funds' then
            TriggerClientEvent('krgsh_banking:client:sendNotification', source, locale("not_enough_money"))
        else
            TriggerClientEvent('krgsh_banking:client:sendNotification', source, locale("fail_transfer"))
        end
        return false
    end
    return getBankData(source)
end)

local function trimDisplayName(raw)
    if type(raw) ~= 'string' then return '' end
    return (raw:match('^%s*(.-)%s*$') or '')
end

local function generateSharedAccountId(targetLen)
    local id
    for _ = 1, 80 do
        local parts = {}
        for i = 1, targetLen do
            parts[i] = tostring(math.random(0, 9))
        end
        id = table.concat(parts)
        if not cachedAccounts[id] then
            return id
        end
    end
    return nil
end

lib.callback.register('krgsh_banking:server:createSharedAccount', function(source, data)
    local now = os.time()
    local last = createSharedCooldown[source]
    if last and (now - last) < 2 then
        Notify(source, { title = locale("bank_name"), description = locale("create_account_rate_limit"), type = "error" })
        return false
    end
    createSharedCooldown[source] = now

    local Player = GetPlayerObject(source)
    if not Player then return false end
    local displayName = trimDisplayName(data and data.displayName)
    local nameLen = utf8.len(displayName) or #displayName
    if displayName == '' or nameLen > 100 then
        Notify(source, { title = locale("bank_name"), description = locale("create_account_invalid_name"), type = "error" })
        return false
    end
    local cid = GetIdentifier(Player)
    local targetLen = personalIdLen(cid)
    local accountId = generateSharedAccountId(targetLen)
    if not accountId then
        Notify(source, { title = locale("bank_name"), description = locale("create_account_failed"), type = "error" })
        return false
    end
    if not cachedPlayers[cid] then UpdatePlayerAccount(cid) end
    cachedAccounts[accountId] = {
        id = accountId,
        type = locale("org"),
        name = displayName,
        display_label = displayName,
        frozen = 0,
        amount = 0,
        transactions = {},
        auth = { [cid] = true },
        creator = cid
    }
    cachedPlayers[cid].accounts[#cachedPlayers[cid].accounts+1] = accountId
    MySQL.insert(
        "INSERT INTO bank_accounts_new (id, amount, transactions, auth, isFrozen, creator, display_label) VALUES (?, ?, ?, ?, ?, ?, ?) ",
        { accountId, 0, json.encode({}), json.encode({ cid }), 0, cid, displayName }
    )
    return getBankData(source)
end)

RegisterNetEvent("krgsh_banking:server:getPlayerAccounts", function()
    local Player = GetPlayerObject(source)
    local cid = GetIdentifier(Player)
    local accounts = cachedPlayers[cid].accounts
    local data = {}
    if #accounts >= 1 then
        for k=1, #accounts do
            if cachedAccounts[accounts[k]].creator == cid then
                data[#data+1] = accounts[k]
            end
        end
    end
    TriggerClientEvent("krgsh_banking:client:accountsMenu", source, data)
end)

RegisterNetEvent("krgsh_banking:server:viewMemberManagement", function(data)
    local Player = GetPlayerObject(source)

    local account = data.account
    local retData = {
        account = account,
        members = {}
    }
    local cid = GetIdentifier(Player)

    for k,_ in pairs(cachedAccounts[account].auth) do
        local Player2 = getPlayerData(source, k)
        if cid ~= GetIdentifier(Player2) then
            retData.members[k] = GetCharacterName(Player2)
        end
    end

    TriggerClientEvent("krgsh_banking:client:viewMemberManagement", source, retData)
end)

RegisterNetEvent('krgsh_banking:server:addAccountMember', function(account, member)
    local Player = GetPlayerObject(source)

    if GetIdentifier(Player) ~= cachedAccounts[account].creator then print(locale("illegal_action", GetPlayerName(source))) return end
    local Player2 = getPlayerData(source, member)
    if not Player2 then return end

    local targetCID = GetIdentifier(Player2)
    if cachedPlayers[targetCID] then
        cachedPlayers[targetCID].accounts[#cachedPlayers[targetCID].accounts+1] = account
    end

    local auth = {}
    for k in pairs(cachedAccounts[account].auth) do auth[#auth+1] = k end
    auth[#auth+1] = targetCID
    cachedAccounts[account].auth[targetCID] = true
    MySQL.update('UPDATE bank_accounts_new SET auth = ? WHERE id = ?',{json.encode(auth), account})
end)

RegisterNetEvent('krgsh_banking:server:removeAccountMember', function(data)
    local Player = GetPlayerObject(source)
    if GetIdentifier(Player) ~= cachedAccounts[data.account].creator then print(locale("illegal_action", GetPlayerName(source))) return end
    local Player2 = getPlayerData(source, data.cid)
    if not Player2 then return end

    local targetCID = GetIdentifier(Player2)
    local tmp = {}
    for k in pairs(cachedAccounts[data.account].auth) do
        if targetCID ~= k then
            tmp[#tmp+1] = k
        end
    end

    if cachedPlayers[targetCID] then
        local newAccount = {}
        if #cachedPlayers[targetCID].accounts >= 1 then
            for k=1, #cachedPlayers[targetCID].accounts do
                if cachedPlayers[targetCID].accounts[k] ~= data.account then
                    newAccount[#newAccount+1] = cachedPlayers[targetCID].accounts[k]
                end
            end
        end
        cachedPlayers[targetCID].accounts = newAccount
    end
    cachedAccounts[data.account].auth[targetCID] = nil
    MySQL.update('UPDATE bank_accounts_new SET auth = ? WHERE id = ?',{json.encode(tmp), data.account})
end)

RegisterNetEvent('krgsh_banking:server:deleteAccount', function(data)
    local account = data.account
    local Player = GetPlayerObject(source)
    local cid = GetIdentifier(Player)

    cachedAccounts[account] = nil

    for k=1, #cachedPlayers[cid].accounts do
        if cachedPlayers[cid].accounts[k] == account then
            cachedPlayers[cid].accounts[k] = nil
        end
    end

    MySQL.update("DELETE FROM `bank_accounts_new` WHERE id=:id", { id = account })
end)

local find = string.find
local sub = string.sub
local function split(str, delimiter)
    local result = {}
    local from = 1
    local delim_from, delim_to = find(str, delimiter, from)
    while delim_from do
        result[#result + 1] = sub(str, from, delim_from - 1)
        from = delim_to + 1
        delim_from, delim_to = find(str, delimiter, from)
    end
    result[#result + 1] = sub(str, from)
    return result
end


--- Updates display label only; primary key `id` stays stable (shared accounts).
local function updateAccountName(account, newLabel, src)
    if not account or not newLabel then return false end
    newLabel = trimDisplayName(tostring(newLabel))
    local labelLen = utf8.len(newLabel) or #newLabel
    if newLabel == '' or labelLen > 100 then
        if src then
            Notify(src, { title = locale("bank_name"), description = locale("create_account_invalid_name"), type = "error" })
        end
        return false
    end
    if not cachedAccounts[account] then
        local getTranslation = locale("invalid_account", account)
        print(getTranslation)
        if src then Notify(src, {title = locale("bank_name"), description = split(getTranslation, '0')[2], type = "error"}) end
        return false
    end
    if src then
        local Player = GetPlayerObject(src)
        if GetIdentifier(Player) ~= cachedAccounts[account].creator then
            local getTranslation = locale("illegal_action", GetPlayerName(src))
            print(getTranslation)
            Notify(src, {title = locale("bank_name"), description = split(getTranslation, '0')[2], type = "error"})
            return false
        end
    end

    cachedAccounts[account].name = newLabel
    cachedAccounts[account].display_label = newLabel
    MySQL.update('UPDATE bank_accounts_new SET display_label = ? WHERE id = ?', { newLabel, account })
    return true
end

RegisterNetEvent('krgsh_banking:server:changeAccountName', function(account, newName)
    updateAccountName(account, newName, source)
end)
--- Changes shared account display label only (not the account id / PK).
exports("changeAccountName", updateAccountName)

--- Retrieves a cached job account if it exists.
---@param jobName string The name of the job whose account is being retrieved.
---@return table|nil account Returns the job account if it exists, otherwise `nil`.
function GetJobAccount(jobName)
    if type(jobName) ~= "string" or jobName == "" then
        error(("^5[%s]^7-^1[ERROR]^7 %s"):format(GetInvokingResource(), "Invalid job name: expected a non-empty string"))
    end
    return cachedAccounts[jobName] or nil -- Returns account if found, otherwise nil
end
exports('GetJobAccount', GetJobAccount)

--- Creates a shared job account for an organization/society.
--- @param job table A table containing job account details:
---        job.name string - The unique identifier for the job (e.g., "mechanic", "police").
---        job.label string - The display name/label for the job (e.g., "Mechanic", "Police Department").
--- @param initialBalance number? The starting balance of the account. Default is 0.
--- @return table Returns the account table if found or successfully created. This function may raise an error if validation or database insertion fails.
local function CreateJobAccount(job, initialBalance)
    local currentResourceName = GetInvokingResource()

    -- Validate input parameters
    if type(job) ~= "table" then
        error(("^5[%s]^7-^1[ERROR]^7 %s"):format(currentResourceName, "Invalid parameter: expected a table (job)"))
    end


    if type(job.name) ~= "string" or job.name == "" then
        error(("^5[%s]^7-^1[ERROR]^7 %s"):format(currentResourceName, "Invalid job name: expected a non-empty string"))
    end

    if type(job.label) ~= "string" or job.label == "" then
        error(("^5[%s]^7-^1[ERROR]^7 %s"):format(currentResourceName, "Invalid job label: expected a non-empty string"))
    end
    
    -- Check if account already exists
    if cachedAccounts[job.name] then
        return cachedAccounts[job.name]
    end

    -- Create the job account in cache
    cachedAccounts[job.name] = {
        id = job.name,
        type = locale("org"),
        name = job.label,
        display_label = nil,
        frozen = 0,
        amount = tonumber(initialBalance) or 0,
        transactions = {},
        auth = {},
        creator = nil
    }

    local success, errorMsg = MySQL.insert("INSERT INTO bank_accounts_new (id, amount, transactions, auth, isFrozen, creator, display_label) VALUES (?, ?, ?, ?, ?, NULL, NULL)", {
        job.name,
        cachedAccounts[job.name].amount,
        json.encode(cachedAccounts[job.name].transactions), -- Convert transactions to JSON
        json.encode(cachedAccounts[job.name].auth), -- Convert auth list to JSON
        cachedAccounts[job.name].frozen
    })

    -- Handle potential database errors
    if not success then
	cachedAccounts[job.name] = nil
        error(("^5[%s]^7-^1[ERROR]^7 %s"):format(currentResourceName, "Database error: " .. tostring(errorMsg)))
    end

    return cachedAccounts[job.name]
end
exports("CreateJobAccount", CreateJobAccount)

local function addAccountMember(account, member)
    if not account or not member then return end

    if not cachedAccounts[account] then print(locale("invalid_account", account)) return end

    local Player2 = getPlayerData(false, member)
    if not Player2 then return end

    local targetCID = GetIdentifier(Player2)
    if cachedPlayers[targetCID] then
        cachedPlayers[targetCID].accounts[#cachedPlayers[targetCID].accounts+1] = account
    end

    local auth = {}
    for k, _ in pairs(cachedAccounts[account].auth) do auth[#auth+1] = k end
    auth[#auth+1] = targetCID
    cachedAccounts[account].auth[targetCID] = true
    MySQL.update('UPDATE bank_accounts_new SET auth = ? WHERE id = ?',{json.encode(auth), account})

end
exports("addAccountMember", addAccountMember)

local function removeAccountMember(account, member)
    local Player2 = getPlayerData(false, member)

    if not Player2 then return end
    if not cachedAccounts[account] then print(locale("invalid_account", account)) return end

    local targetCID = GetIdentifier(Player2)

    local tmp = {}
    for k in pairs(cachedAccounts[account].auth) do
        if targetCID ~= k then
            tmp[#tmp+1] = k
        end
    end

    if cachedPlayers[targetCID] then
        local newAccount = {}
        if #cachedPlayers[targetCID].accounts >= 1 then
            for k=1, #cachedPlayers[targetCID].accounts do
                if cachedPlayers[targetCID].accounts[k] ~= account then
                    newAccount[#newAccount+1] = cachedPlayers[targetCID].accounts[k]
                end
            end
        end
        cachedPlayers[targetCID].accounts = newAccount
    end

    cachedAccounts[account].auth[targetCID] = nil

    MySQL.update('UPDATE bank_accounts_new SET auth = ? WHERE id = ?',{json.encode(tmp), account})
end
exports("removeAccountMember", removeAccountMember)

local function getAccountTransactions(account)
    if cachedAccounts[account] then
        return cachedAccounts[account].transactions
    elseif cachedPlayers[account] then
        return cachedPlayers[account].transactions
    end
    print(locale("invalid_account", account))
    return false
end
exports("getAccountTransactions", getAccountTransactions)

lib.addCommand('givecash', {
    help = 'Gives an item to a player',
    params = {
        {
            name = 'target',
            type = 'playerId',
            help = locale("cmd_plyr_id"),
        },
        {
            name = 'amount',
            type = 'number',
            help = locale("cmd_amount"),
        }
    }
}, function(source, args)
    local Player = GetPlayerObject(source)
    if not Player then return end

    local iPlayer = GetPlayerObject(args.target)
    if not iPlayer then return Notify(source, {title = locale("bank_name"), description = locale('unknown_player', args.target), type = "error"}) end

    if IsDead(Player) then return Notify(source, {title = locale("bank_name"), description = locale('dead'), type = "error"}) end
    if #(GetEntityCoords(GetPlayerPed(source)) - GetEntityCoords(GetPlayerPed(args.target))) > 10.0 then return Notify(source, {title = locale("bank_name"), description = locale('too_far_away'), type = "error"}) end
    if args.amount < 0 then return Notify(source, {title = locale("bank_name"), description = locale('invalid_amount', "give"), type = "error"}) end

    if RemoveMoney(Player, args.amount, 'cash') then
        AddMoney(iPlayer, args.amount, 'cash')
        local nameA = GetCharacterName(Player)
        local nameB = GetCharacterName(iPlayer)
        Notify(source, {title = locale("bank_name"), description = locale('give_cash', nameB, tostring(args.amount)), type = "error"})
        Notify(args.target, {title = locale("bank_name"), description = locale('received_cash', nameA, tostring(args.amount)), type = "success"})
    else
        Notify(args.target, {title = locale("bank_name"), description = locale('not_enough_money'), type = "error"})
    end
end)

function ExportHandler(resource, name, cb)
    AddEventHandler(('__cfx_export_%s_%s'):format(resource, name), function(setCB)
        setCB(cb)
    end)
end

local createTables = {
    { query = "CREATE TABLE IF NOT EXISTS `bank_accounts_new` (`id` varchar(50) NOT NULL, `amount` int(11) DEFAULT 0, `transactions` longtext DEFAULT '[]', `auth` longtext DEFAULT '[]', `isFrozen` int(11) DEFAULT 0, `creator` varchar(50) DEFAULT NULL, `display_label` varchar(100) DEFAULT NULL, PRIMARY KEY (`id`));", values = nil },
    { query = "CREATE TABLE IF NOT EXISTS `player_transactions` (`id` varchar(50) NOT NULL, `isFrozen` int(11) DEFAULT 0, `transactions` longtext DEFAULT '[]', PRIMARY KEY (`id`));", values = nil },
    { query = "CREATE TABLE IF NOT EXISTS `bank_payment_instructions` (`id` varchar(64) NOT NULL, `kind` varchar(32) NOT NULL, `debtor_account_id` varchar(64) NOT NULL, `creditor_target` varchar(64) NOT NULL, `amount` int(11) NOT NULL DEFAULT 0, `interval_seconds` int(11) NOT NULL DEFAULT 0, `next_run_at` bigint NOT NULL, `status` varchar(32) NOT NULL, `metadata` longtext NOT NULL, `created_at` bigint NOT NULL, `updated_at` bigint NOT NULL, PRIMARY KEY (`id`), KEY `idx_pi_next_run` (`next_run_at`,`status`));", values = nil }
}

assert(MySQL.transaction.await(createTables), "Failed to create tables")

pcall(function()
    MySQL.query.await('ALTER TABLE `bank_accounts_new` ADD COLUMN `display_label` varchar(100) DEFAULT NULL')
end)

--- Injected by `server/payment_instructions.lua` after load (same resource chunk).
BankingDeps = {
    executeAccountTransfer = executeAccountTransfer,
    getBankData = getBankData,
    cachedAccounts = cachedAccounts,
    cachedPlayers = cachedPlayers,
    getPlayerData = getPlayerData,
    genTransactionID = genTransactionID,
    sanitizeMessage = sanitizeMessage,
    UpdatePlayerAccount = UpdatePlayerAccount,
}
