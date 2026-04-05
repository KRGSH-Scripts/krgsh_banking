--- Bank card item discovery / add for ox_inventory, qb-inventory, jaksam_inventory.
--- Depends on `config.lua` (shared) and `server/framework.lua` for GetPlayerObject on QB paths.

local function provider()
    return Config.inventoryProvider or 'ox_inventory'
end

local function qbResourceName()
    return Config.inventoryResource or 'qb-inventory'
end

local function started(name)
    return GetResourceState(name) == 'started'
end

---@param src number
---@param itemName string
---@return { metadata: table, slot: any, count: number }[]
local function findBankCardsOx(src, itemName)
    local out = {}
    if not started('ox_inventory') then return out end
    local ok, search = pcall(function()
        return exports.ox_inventory:Search(src, 'slots', itemName)
    end)
    if not ok or not search then return out end
    for slot, data in pairs(search) do
        if type(data) == 'table' and data.metadata then
            out[#out + 1] = {
                slot = slot,
                count = data.count or 1,
                metadata = data.metadata,
            }
        end
    end
    return out
end

---@param src number
---@param itemName string
---@return { metadata: table, slot: any, count: number }[]
local function findBankCardsQb(src, itemName)
    local out = {}
    local res = qbResourceName()
    if not started(res) then return out end
    local Player = GetPlayerObject(src)
    if not Player then return out end
    local items = Player.PlayerData and Player.PlayerData.items
    if type(items) ~= 'table' then return out end
    for slot, it in pairs(items) do
        if type(it) == 'table' and it.name == itemName and type(it.info) == 'table' then
            out[#out + 1] = {
                slot = slot,
                count = it.amount or it.count or 1,
                metadata = it.info,
            }
        end
    end
    return out
end

---@param src number
---@param itemName string
---@return { metadata: table, slot: any, count: number }[]
local function findBankCardsJaksam(src, itemName)
    local out = {}
    if not started('jaksam_inventory') then return out end
    local ok, rows = pcall(function()
        return exports['jaksam_inventory']:getItemsByName(src, itemName)
    end)
    if not ok or type(rows) ~= 'table' then return out end
    for _, row in pairs(rows) do
        if type(row) == 'table' and type(row.metadata) == 'table' then
            out[#out + 1] = {
                slot = row.slot,
                count = row.count or row.amount or 1,
                metadata = row.metadata,
            }
        end
    end
    return out
end

---@param src number
---@param itemName string
---@return { metadata: table, slot: any, count: number }[]
function FindBankCardItems(src, itemName)
    itemName = itemName or Config.bankCardItem or 'bank_card'
    local p = provider()
    if p == 'qb_inventory' then
        return findBankCardsQb(src, itemName)
    elseif p == 'jaksam_inventory' then
        return findBankCardsJaksam(src, itemName)
    end
    return findBankCardsOx(src, itemName)
end

---@param src number
---@param itemName string
---@param metadata table
---@return boolean ok
---@return string? err
function AddBankCardItem(src, itemName, metadata)
    itemName = itemName or Config.bankCardItem or 'bank_card'
    metadata = type(metadata) == 'table' and metadata or {}
    local p = provider()
    if p == 'qb_inventory' then
        local res = qbResourceName()
        if not started(res) then return false, 'inventory_offline' end
        local ok, err = pcall(function()
            exports[res]:AddItem(src, itemName, 1, false, metadata)
        end)
        if ok then return true end
        local Player = GetPlayerObject(src)
        if Player and Player.Functions and Player.Functions.AddItem then
            local ok2, err2 = pcall(function()
                Player.Functions.AddItem(itemName, 1, false, metadata)
            end)
            return ok2, (not ok2) and tostring(err2) or nil
        end
        return false, err and tostring(err) or 'additem_failed'
    elseif p == 'jaksam_inventory' then
        if not started('jaksam_inventory') then return false, 'inventory_offline' end
        local ok, err = pcall(function()
            exports['jaksam_inventory']:addItem(src, itemName, 1, metadata)
        end)
        return ok, (not ok) and tostring(err) or nil
    end
    if not started('ox_inventory') then return false, 'inventory_offline' end
    local ok, err = pcall(function()
        exports.ox_inventory:AddItem(src, itemName, 1, metadata)
    end)
    return ok, (not ok) and tostring(err) or nil
end
