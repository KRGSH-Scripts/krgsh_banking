local isVisible = false
local progressBar = Config.progressbar == 'circle' and lib.progressCircle or lib.progressBar
PlayerPed = cache.ped

lib.onCache('ped', function(newPed)
	PlayerPed = newPed
end)

local function nuiHandler(val)
    isVisible = val
    SetNuiFocus(val, val)
end

local function copyTable(tbl)
    if type(tbl) ~= 'table' then return {} end
    local out = {}
    for key, value in pairs(tbl) do
        out[key] = type(value) == 'table' and copyTable(value) or value
    end
    return out
end

local function getConfigBankingOverrides(data)
    if type(data) ~= 'table' then return {} end
    if type(data.BankConfig) == 'table' then return data.BankConfig end
    if type(data.bankConfig) == 'table' then return data.bankConfig end
    return {}
end

local function buildOpenUiTargetData(isAtm, sourceData)
    sourceData = type(sourceData) == 'table' and sourceData or {}
    local contextDefaults = (Config.uiDefaults and Config.uiDefaults[isAtm and 'atm' or 'bank']) or {}
    local bankConfig = getConfigBankingOverrides(sourceData)

    return {
        atm = isAtm,
        theme = bankConfig.theme or sourceData.theme or contextDefaults.theme,
        institution = bankConfig.institution or sourceData.institution or contextDefaults.institution,
        subtitle = bankConfig.subtitle or sourceData.subtitle or contextDefaults.subtitle,
        location = (not isAtm) and (bankConfig.location or sourceData.location or contextDefaults.location) or nil,
        contextLabel = bankConfig.contextLabel or sourceData.contextLabel or contextDefaults.contextLabel,
        colors = bankConfig.colors or sourceData.colors,
        logo = bankConfig.logo or sourceData.logo
    }
end

local function getStreetLocationLabel()
    local coords = GetEntityCoords(PlayerPed)
    local streetHash, crossingHash = GetStreetNameAtCoord(coords.x, coords.y, coords.z)
    local street = streetHash and GetStreetNameFromHashKey(streetHash) or nil
    local crossing = crossingHash and crossingHash ~= 0 and GetStreetNameFromHashKey(crossingHash) or nil

    if street and street ~= '' and crossing and crossing ~= '' then
        return ('%s / %s'):format(street, crossing)
    end

    if street and street ~= '' then
        return street
    end

    local zoneLabel = GetNameOfZone(coords.x, coords.y, coords.z)
    return zoneLabel and GetLabelText(zoneLabel) or nil
end

local function resolveUiTheme(data)
    data = type(data) == 'table' and data or { atm = data == true }
    local contextKey = data.atm and 'atm' or 'bank'
    local defaults = (Config.uiDefaults and Config.uiDefaults[contextKey]) or {}

    local themeKey = data.theme or data.uiTheme or defaults.theme
    local themeConfig = (Config.uiThemes and themeKey and Config.uiThemes[themeKey]) or {}
    local colors = copyTable(themeConfig.colors)

    if type(data.colors) == 'table' then
        for key, value in pairs(data.colors) do
            colors[key] = value
        end
    end

    return {
        key = themeKey or 'DEFAULT',
        name = data.institution or data.uiInstitution or defaults.institution or locale('bank_name'),
        subtitle = data.subtitle or data.uiSubtitle or defaults.subtitle or (data.atm and 'ATM Self-Service' or 'Modern Homebanking'),
        contextLabel = data.contextLabel or data.uiContextLabel or defaults.contextLabel or (data.atm and 'ATM' or 'Bank'),
        location = data.location or data.uiLocation or defaults.location,
        logo = data.logo or data.uiLogo or themeConfig.logo,
        colors = colors
    }
end

--- Resolve PIN-locked shared accounts (card-bound); returns accounts table or nil if cancelled/failed.
local function ensureBankCardPins(accounts, depth)
    depth = (depth or 0) + 1
    if depth > 12 or not accounts then return accounts end
    for i = 1, #accounts do
        local acc = accounts[i]
        if acc.needsBankCardPin and acc.bankCardId then
            local input = lib.inputDialog(locale('bank_card_pin_title'), {{
                type = 'input',
                label = locale('bank_card_pin_label'),
                password = true,
            }})
            local pin = input and input[1]
            if not pin or pin == '' then
                lib.notify({ title = locale('bank_name'), description = locale('bank_card_pin_cancel'), type = 'error' })
                return nil
            end
            local refreshed = lib.callback.await('krgsh_banking:server:verifyBankCardPin', false, {
                accountId = acc.id,
                cardId = acc.bankCardId,
                pin = pin,
            })
            if not refreshed then
                lib.notify({ title = locale('bank_name'), description = locale('bank_card_pin_wrong'), type = 'error' })
                return nil
            end
            return ensureBankCardPins(refreshed, depth)
        end
    end
    return accounts
end

local function openBankUI(openData)
    openData = type(openData) == 'table' and openData or { atm = openData == true }
    local isAtm = openData.atm == true
    local canCreateAccounts = (not isAtm) and openData.createAccounts == true
    if isAtm then
        openData.location = getStreetLocationLabel()
    end
    SendNUIMessage({action = 'setLoading', status = true})
    nuiHandler(true)
    lib.callback('krgsh_banking:server:initalizeBanking', false, function(accounts)
        if not accounts then
            nuiHandler(false)
            lib.notify({title = locale('bank_name'), description = locale('loading_failed'), type = 'error'})
            return
        end
        accounts = ensureBankCardPins(accounts, 0)
        if not accounts then
            nuiHandler(false)
            return
        end
        SetTimeout(1000, function()
            SendNUIMessage({
                action = 'setVisible',
                status = isVisible,
                accounts = accounts,
                loading = false,
                atm = isAtm,
                canCreateAccounts = canCreateAccounts,
                theme = resolveUiTheme(openData)
            })
        end)
    end)
end

RegisterNetEvent('krgsh_banking:client:openBankUI', function(data)
    data = type(data) == 'table' and data or { atm = data == true }
    local txt = data.atm and locale('open_atm') or locale('open_bank')
    TaskStartScenarioInPlace(PlayerPed, 'PROP_HUMAN_ATM', 0, true)
    if progressBar({
        label = txt,
        duration = math.random(3000,5000),
        position = 'bottom',
        useWhileDead = false,
        allowCuffed = false,
        allowFalling = false,
        canCancel = true,
        disable = {
            car = true,
            move = true,
            combat = true,
            mouse = false,
        }
    }) then
        openBankUI(data)
        Wait(500)
        ClearPedTasksImmediately(PlayerPed)
    else
        ClearPedTasksImmediately(PlayerPed)
        lib.notify({title = locale('bank_name'), description = locale('canceled'), type = 'error'})
    end
end)

RegisterNUICallback('closeInterface', function(_, cb)
    nuiHandler(false)
    cb('ok')
end)

RegisterCommand('closeBankUI', function() nuiHandler(false) end, false)

--- NUI callbacks sofort registrieren (nicht erst im ATM-CreateThread), sonst fehlen sie beim ersten fetch.
local bankActions = {'deposit', 'withdraw', 'transfer'}
for k = 1, #bankActions do
    local action = bankActions[k]
    RegisterNUICallback(action, function(data, cb)
        local newTransaction = lib.callback.await('krgsh_banking:server:' .. action, false, data)
        cb(newTransaction)
    end)
end

RegisterNUICallback('createAccount', function(data, cb)
    local payload = lib.callback.await('krgsh_banking:server:createSharedAccount', false, {
        displayName = type(data) == 'table' and data.displayName or nil
    })
    cb(payload or false)
end)

RegisterNUICallback('listPaymentInstructions', function(data, cb)
    local atm = type(data) == 'table' and data.atm == true
    local list = lib.callback.await('krgsh_banking:server:listPaymentInstructions', false, { atm = atm })
    cb(list or {})
end)

RegisterNUICallback('createStandingOrder', function(data, cb)
    local payload = lib.callback.await('krgsh_banking:server:createStandingOrder', false, type(data) == 'table' and data or {})
    cb(payload or { success = false })
end)

RegisterNUICallback('updatePaymentInstruction', function(data, cb)
    local payload = lib.callback.await('krgsh_banking:server:updatePaymentInstruction', false, type(data) == 'table' and data or {})
    cb(payload or { success = false })
end)

RegisterNUICallback('respondMandate', function(data, cb)
    local payload = lib.callback.await('krgsh_banking:server:respondMandate', false, type(data) == 'table' and data or {})
    cb(payload or { success = false })
end)

RegisterNetEvent('krgsh_banking:client:pendingMandate', function()
    lib.notify({
        title = locale('bank_name'),
        description = locale('pi_pending_mandate'),
        type = 'inform',
    })
end)

local atmTargetModels = {}
CreateThread(function ()
    local addedModels = {}
    for i = 1, #Config.atms do
        local atmEntry = Config.atms[i]
        local model = type(atmEntry) == 'table' and (atmEntry.model or atmEntry[1]) or atmEntry
        if model and not addedModels[tostring(model)] then
            local targetData = buildOpenUiTargetData(true, type(atmEntry) == 'table' and atmEntry or {})
            atmTargetModels[#atmTargetModels+1] = model
            addedModels[tostring(model)] = true

            exports.ox_target:addModel(model, {{
                name = 'krgsh_banking_openui',
                event = 'krgsh_banking:client:openBankUI',
                icon = 'fas fa-money-check',
                label = locale('view_bank'),
                atm = true,
                theme = targetData.theme,
                institution = targetData.institution,
                subtitle = targetData.subtitle,
                location = targetData.location,
                contextLabel = targetData.contextLabel,
                colors = targetData.colors,
                logo = targetData.logo,
                canInteract = function(_, distance)
                    return distance < 2.5
                end
            }})
        end
    end
end)

local pedSpawned = false
local blips = {}
function CreatePeds()
    if pedSpawned then return end
    for k = 1, #Config.peds do
        local pedConfig = Config.peds[k]
        local coords = pedConfig.coords
        local pedOpenUi = buildOpenUiTargetData(false, pedConfig)
        local pedPoint = lib.points.new({
            coords = coords,
            distance = 300,
            model = joaat(pedConfig.model),
            heading = coords.w,
            ped = nil,
            targetOptions = {{
                name = 'krgsh_banking_accountmng',
                event = 'krgsh_banking:client:accountManagmentMenu',
                icon = 'fas fa-money-check',
                label = locale('manage_bank'),
                atm = false,
                canInteract = function(_, distance)
                    return distance < 4.5 and pedConfig.createAccounts
                end
            },{
                name = 'krgsh_banking_openui',
                event = 'krgsh_banking:client:openBankUI',
                icon = 'fas fa-money-check',
                label = locale('view_bank'),
                atm = false,
                createAccounts = pedConfig.createAccounts,
                theme = pedOpenUi.theme,
                institution = pedOpenUi.institution,
                subtitle = pedOpenUi.subtitle,
                location = pedOpenUi.location,
                contextLabel = pedOpenUi.contextLabel,
                colors = pedOpenUi.colors,
                logo = pedOpenUi.logo,
                canInteract = function(_, distance)
                    return distance < 4.5
                end
            }}
        })

        function pedPoint:onEnter()
            lib.requestModel(self.model, 10000)

            self.ped = CreatePed(0, self.model, self.coords.x, self.coords.y, self.coords.z-1, self.heading, false, false)
            SetEntityHeading(self.ped, self.heading)
            SetModelAsNoLongerNeeded(self.model)

            TaskStartScenarioInPlace(self.ped, 'PROP_HUMAN_STAND_IMPATIENT', 0, true)
            FreezeEntityPosition(self.ped, true)
            SetEntityInvincible(self.ped, true)
            SetBlockingOfNonTemporaryEvents(self.ped, true)
            exports.ox_target:addLocalEntity(self.ped, self.targetOptions)
        end

        function pedPoint:onExit()
            exports.ox_target:removeLocalEntity(self.ped, self.advanced and 'krgsh_banking_accountmng' or 'krgsh_banking_openui')
            if DoesEntityExist(self.ped) then
                DeletePed(self.ped)
            end
            self.ped = nil
        end

        blips[k] = AddBlipForCoord(coords.x, coords.y, coords.z-1)
        SetBlipSprite(blips[k], 108)
        SetBlipDisplay(blips[k], 4)
        SetBlipScale  (blips[k], 0.80)
        SetBlipColour (blips[k], 2)
        SetBlipAsShortRange(blips[k], true)
        BeginTextCommandSetBlipName('STRING')
        AddTextComponentString('Bank')
        EndTextCommandSetBlipName(blips[k])
    end
    pedSpawned = true
end

function DeletePeds()
    if not pedSpawned then return end
    local points = lib.points.getAllPoints()
    for i = 1, #points do
        if DoesEntityExist(points[i].ped) then
            DeletePed(points[i].ped)
        end
        points[i]:remove()
    end
    for i = 1, #blips do
        RemoveBlip(blips[i])
    end
    pedSpawned = false
end

AddEventHandler('onResourceStop', function(resource)
    if resource ~= GetCurrentResourceName() then return end
    if #atmTargetModels > 0 then
        exports.ox_target:removeModel(atmTargetModels, {'krgsh_banking_openui'})
    else
        exports.ox_target:removeModel(Config.atms, {'krgsh_banking_openui'})
    end
    DeletePeds()
end)

RegisterNetEvent('krgsh_banking:client:sendNotification', function(msg)
    if not msg then return end
    SendNUIMessage({
        action = 'notify',
        status = msg,
    })
end)

RegisterNetEvent('krgsh_banking:client:viewAccountsMenu', function()
    TriggerServerEvent('krgsh_banking:server:getPlayerAccounts')
end)
