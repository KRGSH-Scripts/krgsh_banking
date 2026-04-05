---
title: "Server-Cache-System"
description: "In-Memory-Cache für Konten und Spieler-Transaktionen: Aufbau, Invalidierung und Performance-Strategie."
tags: ["fivem", "banking", "lua", "cache", "performance"]
order: 5
---

# Server-Cache-System

## Zweck

Der In-Memory-Cache vermeidet wiederholte DB-Queries während der Laufzeit. Er ist die **Single Source of Truth** für alle Org/Shared-Konten während die Resource läuft.

---

## Cache-Strukturen

### `cachedAccounts`

```lua
local cachedAccounts = {}
-- cachedAccounts["jobname_or_account_id"] = {
--     id           = "police",
--     type         = "Organization",
--     name         = "Los Santos Police Department",
--     frozen       = false,
--     amount       = 150000,
--     transactions = { ... },
--     auth         = { ["CID123"] = true, ["CID456"] = true },
--     creator      = nil          -- nil für Org, CitizenID für Shared
-- }
```

**Enthält:** alle Org-Konten (Jobs + Gangs) und alle Shared-Konten

### `cachedPlayers`

```lua
local cachedPlayers = {}
-- cachedPlayers["CID123"] = {
--     isFrozen     = 0,
--     transactions = { ... },     -- Persönliche Buchungshistorie
--     accounts     = { "shared_account_1", "shared_account_2" }
-- }
```

**Enthält:** persönliche Transaktionshistorie + Liste zugänglicher Shared-Account-IDs

---

## Cache-Initialisierung (beim Ressourcen-Start)

```
Wait(500)  -- kurze Verzögerung für DB-Verbindung
→ UI-Datei prüfen (app.js vorhanden?)
→ MySQL: SELECT * FROM bank_accounts_new
  → alle Konten in cachedAccounts laden
  → auth-JSON dekodieren und als Map umbauen
→ GetFrameworkGroups() → alle Jobs + Gangs
  → fehlende Einträge: cachedAccounts + MySQL.transaction (batch INSERT)
```

Der Batch-INSERT nutzt `MySQL.transaction.await(query)` für atomare Ausführung.

---

## Player-Cache befüllen: `UpdatePlayerAccount(cid)`

Wird aufgerufen bei:
- Server-seitigem `QBCore:Server:PlayerLoaded`
- ESX `esx:onPlayerSpawn`
- `onResourceStart` (für alle bereits eingeloggten Spieler)

```lua
function UpdatePlayerAccount(cid)
    -- 1. player_transactions WHERE id = cid
    -- 2. bank_accounts_new WHERE auth LIKE '%cid%'
    cachedPlayers[cid] = {
        isFrozen     = 0,
        transactions = decoded_transactions,
        accounts     = shared_account_ids
    }
end
```

Die LIKE-Query (`auth LIKE '%cid%'`) ist eine einfache String-Suche im JSON-Feld. Für große Installations-Installationen ist dies potentiell eine Performance-Schwachstelle.

---

## Cache-Update-Regeln

### Kontostands-Update

```lua
-- Nur Cache, dann DB
cachedAccounts[account].amount += amount
MySQL.prepare("UPDATE bank_accounts_new SET amount = ? WHERE id = ?", ...)
```

### Transaktions-Update

```lua
-- Erst Cache (neueste zuerst), dann DB
table.insert(cachedAccounts[account].transactions, 1, transaction)
MySQL.prepare("INSERT ... ON DUPLICATE KEY UPDATE transactions = ?", ...)
```

### Auth-Update (Mitglieder)

```lua
-- 1. Cache: cachedAccounts[account].auth[cid] = true
-- 2. Cache: cachedPlayers[cid].accounts ergänzen (wenn Spieler online)
-- 3. DB: UPDATE bank_accounts_new SET auth = ? WHERE id = ?
```

---

## Lazy-Load-Fallback

In `getBankData()` gibt es einen Fallback:

```lua
if not cachedPlayers[cid] then UpdatePlayerAccount(cid) end
```

Falls ein Spieler keinen Cache-Eintrag hat (z.B. nach Ressourcen-Neustart ohne Player-Reload), wird der Eintrag synchron nachgeladen.

---

## Cache-Invalidierung

| Aktion | Cache-Auswirkung |
|---|---|
| Account umbenennen | `cachedAccounts[newName]` = Deep-Copy, `cachedAccounts[old] = nil`, alle `cachedPlayers.accounts` aktualisieren |
| Account löschen | `cachedAccounts[id] = nil`, `cachedPlayers[cid].accounts` bereinigen |
| Mitglied hinzufügen | `cachedAccounts[account].auth[cid] = true`, `cachedPlayers[cid].accounts` ergänzen |
| Mitglied entfernen | `cachedAccounts[account].auth[cid] = nil`, `cachedPlayers[cid].accounts` bereinigen |

---

## Bekannte Einschränkungen

1. **Kein Persistenz-Check bei Neustart:** Nach einem Ressourcen-Neustart werden alle Spieler-Caches neu aufgebaut. Kein Datenverlust (DB ist die Quelle), aber kurze Latenz.
2. **LIKE-Query für Auth:** Die `WHERE auth LIKE '%cid%'`-Query skaliert nicht gut bei sehr vielen Konten.
3. **Deep-Copy bei Rename:** `json.decode(json.encode(...))` für Deep-Copy ist funktional, aber nicht performant für Konten mit langer Transaktionshistorie.
4. **Offline-Spieler:** `cachedPlayers[cid]` wird nur für eingeloggte oder nach-geladene Spieler befüllt. Überweisungen zu Offline-Spielern sind daher nicht möglich.
