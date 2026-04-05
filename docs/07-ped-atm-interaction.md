# Peds, ATMs und Client-Interaktion

## Überblick

Die Client-Seite verwaltet drei Arten von Interaktionspunkten:
1. **ATM-Modelle** – Statische Spielwelt-Props mit ox_target
2. **Bank-Peds** – Dynamisch gespawnte NPCs mit ox_target, über lib.points verwaltet
3. **Karten-Blips** – Minimap-Markierungen für Bank-Standorte

---

## ATM-System

### Konfiguration (`config.lua`)

```lua
Config.atms = {
    `prop_atm_01`,   -- einfacher Hash
    `prop_atm_02`,
    `prop_atm_03`,
    `prop_fleeca_atm`,
    -- oder mit Branding:
    -- { model = `prop_fleeca_atm`, BankConfig = { theme = 'FLEECA', institution = 'FLEECA Bank' } }
}
```

Jeder Eintrag kann entweder ein einfacher Model-Hash oder eine Table mit optionalem `BankConfig`-Theming sein.

### ox_target-Registrierung

```lua
exports.ox_target:addModel(model, {{
    name  = 'krgsh_banking_openui',
    event = 'krgsh_banking:client:openBankUI',
    icon  = 'fas fa-money-check',
    label = locale('view_bank'),
    atm   = true,
    -- + Theme-Daten aus BankConfig
    canInteract = function(_, distance)
        return distance < 2.5
    end
}})
```

Duplikate werden durch eine `addedModels`-Map verhindert.

### Cleanup beim Stopp

```lua
AddEventHandler('onResourceStop', function(resource)
    exports.ox_target:removeModel(atmTargetModels, {'krgsh_banking_openui'})
    DeletePeds()
end)
```

---

## Bank-Ped-System

### Konfiguration (`config.lua`)

```lua
Config.peds = {
    [1] = {
        model        = 'u_m_m_bankman',
        coords       = vector4(241.44, 227.19, 106.29, 170.43),
        createAccounts = true,     -- zeigt "Konto verwalten" Option
        -- optional:
        -- BankConfig = { theme = 'MAZE_BANK', institution = 'MAZE BANK', ... }
    },
    -- ...
}
```

### lib.points – Distanz-basiertes Spawning

Peds werden nicht global gespawnt, sondern über `lib.points.new()` distanz-basiert:

```lua
local pedPoint = lib.points.new({
    coords   = coords,
    distance = 300,        -- Aktivierungsradius in Metern
    model    = joaat(pedConfig.model),
    heading  = coords.w,
    ped      = nil,
    targetOptions = { ... }
})

function pedPoint:onEnter()
    -- Model laden, Ped spawnen, ox_target registrieren
    lib.requestModel(self.model, 10000)
    self.ped = CreatePed(0, self.model, ...)
    FreezeEntityPosition(self.ped, true)
    SetEntityInvincible(self.ped, true)
    SetBlockingOfNonTemporaryEvents(self.ped, true)
    TaskStartScenarioInPlace(self.ped, 'PROP_HUMAN_STAND_IMPATIENT', 0, true)
    exports.ox_target:addLocalEntity(self.ped, self.targetOptions)
end

function pedPoint:onExit()
    exports.ox_target:removeLocalEntity(self.ped, ...)
    DeletePed(self.ped)
    self.ped = nil
end
```

### Ped-Zustands-Flags

| Flag | Wert |
|---|---|
| `FreezeEntityPosition` | true – kein Physik-Drift |
| `SetEntityInvincible` | true – kein Schaden |
| `SetBlockingOfNonTemporaryEvents` | true – ignoriert NPCs/Spieler |
| Szenario | `PROP_HUMAN_STAND_IMPATIENT` – Warte-Animation |

### Zwei Target-Optionen pro Ped

```lua
-- Option 1: Konto verwalten (nur wenn createAccounts = true)
{
    name        = 'krgsh_banking_accountmng',
    event       = 'krgsh_banking:client:accountManagmentMenu',
    canInteract = function(_, distance)
        return distance < 4.5 and pedConfig.createAccounts
    end
}
-- Option 2: Bank öffnen (immer)
{
    name        = 'krgsh_banking_openui',
    event       = 'krgsh_banking:client:openBankUI',
    canInteract = function(_, distance)
        return distance < 4.5
    end
}
```

---

## OpenBankUI – Öffnungsablauf

### 1. Event empfangen

```lua
RegisterNetEvent('krgsh_banking:client:openBankUI', function(data)
```

`data` enthält optionale Theme-Daten (theme, institution, subtitle, location, contextLabel, colors, logo).

### 2. Progressbar

```lua
progressBar({
    label    = txt,
    duration = math.random(3000, 5000),
    position = 'bottom',
    disable  = { car = true, move = true, combat = true },
    canCancel = true
})
```

`Config.progressbar = 'circle'` → `lib.progressCircle`, sonst `lib.progressBar`

Während der Progressbar: `TaskStartScenarioInPlace(PlayerPed, 'PROP_HUMAN_ATM', 0, true)` (ATM-Benutzungsanimation).

### 3. UI öffnen

```lua
local function openBankUI(openData)
    if isAtm then
        openData.location = getStreetLocationLabel()  -- automatischer Standort
    end
    SendNUIMessage({action = 'setLoading', status = true})
    nuiHandler(true)  -- NUI-Fokus aktivieren
    lib.callback('krgsh_banking:server:initalizeBanking', false, function(accounts)
        SetTimeout(1000, function()
            SendNUIMessage({
                action  = 'setVisible',
                status  = isVisible,
                accounts = accounts,
                loading  = false,
                atm     = isAtm,
                theme   = resolveUiTheme(openData)
            })
        end)
    end)
end
```

---

## Theme-Auflösung

```lua
local function resolveUiTheme(data)
    -- Priorität: data.theme > Config.uiDefaults[context].theme
    local themeKey = data.theme or defaults.theme
    local themeConfig = Config.uiThemes[themeKey] or {}
    -- Farben zusammenführen: Theme-Colors + optionale Overrides
    return {
        key          = themeKey,
        name         = data.institution or defaults.institution,
        subtitle     = data.subtitle or defaults.subtitle,
        contextLabel = data.contextLabel or defaults.contextLabel,
        location     = data.location or defaults.location,
        logo         = data.logo or themeConfig.logo,
        colors       = merged_colors
    }
end
```

---

## Standort-Erkennung für ATMs

```lua
local function getStreetLocationLabel()
    local coords = GetEntityCoords(PlayerPed)
    local streetHash, crossingHash = GetStreetNameAtCoord(...)
    -- Gibt "Straße / Kreuzung" zurück, oder Zonenname als Fallback
end
```

Wird automatisch beim Öffnen eines ATMs aufgerufen und als `location` an die UI übergeben.

---

## Blips (Minimap-Markierungen)

Für jeden konfigurierten Ped wird ein Blip erstellt:

```lua
blips[k] = AddBlipForCoord(coords.x, coords.y, coords.z - 1)
SetBlipSprite(blips[k], 108)       -- Bank-Icon
SetBlipDisplay(blips[k], 4)
SetBlipScale(blips[k], 0.80)
SetBlipColour(blips[k], 2)         -- Grün
SetBlipAsShortRange(blips[k], true)
-- Label: "Bank"
```

Blips werden bei `DeletePeds()` entfernt.

---

## NUI-Kontrolle

```lua
local function nuiHandler(val)
    isVisible = val
    SetNuiFocus(val, val)   -- Fokus + Maus-Sichtbarkeit
end

RegisterNUICallback('closeInterface', function(_, cb)
    nuiHandler(false)
    cb('ok')
end)

RegisterCommand('closeBankUI', function() nuiHandler(false) end, false)
```

---

## Server-Notifications an UI

```lua
RegisterNetEvent('krgsh_banking:client:sendNotification', function(msg)
    SendNUIMessage({ action = 'notify', status = msg })
end)
```

Wird vom Server ausgelöst wenn Buchungen fehlschlagen (z.B. "Kein Guthaben").
