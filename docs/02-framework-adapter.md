# Framework-Adapter-System

## Zweck

Der Framework-Adapter abstrahiert alle framework-spezifischen API-Aufrufe hinter einheitlichen Lua-Funktionen. Dadurch bleibt die Kernlogik in `server/main.lua` vollständig framework-agnostisch.

---

## Framework-Erkennung

Sowohl Client als auch Server nutzen identische Erkennungslogik:

```lua
local Framework = GetResourceState('es_extended') == 'started' and 'esx'
    or GetResourceState('qbx_core') == 'started' and 'qbx'
    or GetResourceState('qb-core') == 'started' and 'qb'
    or 'Unknown'
```

**Prioritätsreihenfolge:** ESX → QBX → QBCore → Unknown

Bei `Unknown` wird `StopResource(GetCurrentResourceName())` aufgerufen.

---

## Server-Adapter-Funktionen (`server/framework.lua`)

### Spieler-Lookups

| Funktion | Beschreibung |
|---|---|
| `GetPlayerObject(source)` | Gibt das Framework-Spielerobjekt anhand der Server-ID zurück |
| `GetPlayerObjectFromID(identifier)` | Sucht einen Spieler anhand seiner CitizenID (QB/QBX) oder seines Identifiers (ESX) |

**QB/QBX:** `identifier` wird automatisch auf Großbuchstaben normiert.

### Spieler-Daten

| Funktion | Rückgabe |
|---|---|
| `GetCharacterName(Player)` | `"Vorname Nachname"` (QB/QBX) / `Player.name` (ESX) |
| `GetIdentifier(Player)` | `citizenid` (QB/QBX) / `identifier` (ESX) |
| `GetFunds(Player)` | `{ cash: number, bank: number }` |

### Geldoperationen

| Funktion | Beschreibung |
|---|---|
| `AddMoney(Player, Amount, Type, comment)` | Fügt `cash` oder `bank` hinzu |
| `RemoveMoney(Player, Amount, Type, comment)` | Zieht ab, prüft auf ausreichendes Guthaben, gibt `true/false` zurück |

`Type` ist `'cash'` oder `'bank'`.

### Job / Gang / Berechtigung

| Funktion | Beschreibung |
|---|---|
| `GetJobs(Player)` | Gibt `{ name, grade }` zurück. Bei MultiJob-Aktivierung (`Config.krgshMultiJob`) eine Array-Table aller Jobs |
| `GetGang(Player)` | Gibt `gang.name` zurück (ESX: immer `false`) |
| `IsJobAuth(job, grade)` | Prüft, ob der Grade `bankAuth = true` hat (QB/QBX) oder `boss`-Grade (ESX) |
| `IsGangAuth(Player, gang)` | Prüft Gang-Bankberechtigung (QB/QBX only) |
| `GetFrameworkGroups()` | Gibt `Jobs, Gangs` als Tables zurück |
| `GetSocietyLabel(society)` | Gibt das Label eines Jobs/Gangs zurück |

### Benachrichtigungen & Zustand

| Funktion | Beschreibung |
|---|---|
| `Notify(src, settings)` | Sendet `ox_lib:notify` an Client |
| `IsDead(Player)` | `true` wenn Spieler tot ist (ESX trackt dies über Events) |

---

## Client-Adapter (`client/framework.lua`)

### FullyLoaded-Flag

```lua
FullyLoaded = false
```

Wird über State-Bag (`isLoggedIn`) und Framework-Events gesetzt:
- QB/QBX: `LocalPlayer.state.isLoggedIn` + `AddStateBagChangeHandler`
- ESX: `esx:playerLoaded` Event

### Player-Lifecycle Hooks

| Event | Aktion |
|---|---|
| `QBCore:Client:OnPlayerLoaded` | `initalizeBanking()` aufrufen |
| `esx:playerLoaded` | `FullyLoaded = true` + `initalizeBanking()` |
| `onResourceStart` | `initalizeBanking()` wenn bereits eingeloggt |
| `QBCore:Client:OnPlayerUnload` | `DeletePeds()` |
| `esx:onPlayerLogout` | `DeletePeds()` |

### `initalizeBanking()` (Client)

```lua
local function initalizeBanking()
    CreatePeds()
    local locales = lib.getLocales()
    SendNUIMessage({
        action = 'updateLocale',
        translations = locales,
        currency = Config.currency
    })
end
```

Erstellt alle Bank-Peds und sendet die Locale-Daten an die NUI.

---

## Server-Lifecycle Hooks (`server/framework.lua`)

| Event | Aktion |
|---|---|
| `QBCore:Server:PlayerLoaded` | `UpdatePlayerAccount(cid)` |
| `esx:onPlayerSpawn` | `deadPlayers[source] = nil` + `UpdatePlayerAccount(cid)` |
| `esx:onPlayerDeath` | `deadPlayers[source] = true` |
| `esx:playerDropped` | `deadPlayers[playerId] = nil` |
| `onResourceStart` | Alle eingeloggten Spieler nachladen |

---

## Kompatibilitäts-Exports

### QB-Management Shim

```lua
ExportHandler("qb-management", "GetAccount",      GetAccountMoney)
ExportHandler("qb-management", "GetGangAccount",  GetAccountMoney)
ExportHandler("qb-management", "AddMoney",        AddAccountMoney)
ExportHandler("qb-management", "AddGangMoney",    AddAccountMoney)
ExportHandler("qb-management", "RemoveMoney",     RemoveAccountMoney)
ExportHandler("qb-management", "RemoveGangMoney", RemoveAccountMoney)
```

### ESX-Society Shim

```lua
ExportHandler("esx_society", "GetSociety",    GetAccountMoney)
RegisterServerEvent('esx_society:getSociety', GetAccountMoney)
RegisterServerEvent('esx_society:depositMoney',  AddAccountMoney)
RegisterServerEvent('esx_society:withdrawMoney', RemoveAccountMoney)
```

---

## MultiJob-Unterstützung (QBCore only)

Wenn `Config.krgshMultiJob = true`, ruft `GetJobs()` statt dem Haupt-Job alle Jobs über `exports['qb-phone']:getJobs(citizenid)` ab. Jeder Job-Eintrag wird normiert auf `{ name, grade }`.

---

## Erweiterung um neue Frameworks

1. Framework-Erkennung in beiden `framework.lua`-Dateien ergänzen
2. Alle Adapter-Funktionen für das neue Framework implementieren
3. Ggf. Lifecycle-Events registrieren
4. `IsJobAuth` und `IsGangAuth` für die neuen Berechtigungsstrukturen anpassen

Die Kernlogik in `server/main.lua` und das Frontend müssen **nicht** angepasst werden.
