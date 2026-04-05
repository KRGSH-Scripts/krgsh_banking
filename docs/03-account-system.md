# Kontosystem (Account System)

## Kontentypen

Das System kennt drei logische Kontentypen, die alle über dieselbe Cache- und DB-Struktur verwaltet werden:

| Typ | Lokale Bezeichnung | Quelle |
|---|---|---|
| `personal` | `locale("personal")` | Framework-Spieler-Bankguthaben (kein DB-Konto) |
| `org` | `locale("org")` | `bank_accounts_new` – automatisch für Jobs/Gangs angelegt |
| `shared` | `locale("org")` (UI-seitig gleich) | `bank_accounts_new` – manuell erstellt, mit `creator` |

> **Hinweis:** Shared-Accounts werden in der UI als Org-Typ angezeigt. Die Unterscheidung erfolgt serverseitig über das Feld `creator`.

---

## Datenmodell

### Account-Objekt (im Cache und UI)

```lua
{
    id          = "jobname_or_citizenid",  -- string, eindeutiger Schlüssel
    type        = locale("org"),           -- "Organization" (lokalisiert)
    name        = "Anzeigename",           -- Label aus Framework oder Account-ID
    frozen      = false,                   -- boolean/number (0|1)
    amount      = 0,                       -- number, aktueller Kontostand
    transactions = {},                     -- array<Transaction>
    auth        = { ["CID123"] = true },   -- map<citizenid, true> (nur org/shared)
    creator     = "CID123" or nil          -- string|nil (nur shared accounts)
}
```

### Personal-Account-Erweiterung (nur im UI-Payload)

```lua
{
    id   = "AB1234",   -- CitizenID des Spielers
    type = locale("personal"),
    name = "Vorname Nachname",
    cash = 500,        -- Bargeld (nur personal, nicht in DB)
    ...
}
```

---

## Konto-Lebenszyklen

### Personal-Account

- Kein eigenes DB-Konto.
- Wird bei jedem `getBankData()`-Aufruf dynamisch aus `GetFunds(Player)` zusammengebaut.
- Transaktionen werden in `player_transactions` (Tabelle) gespeichert, gecacht in `cachedPlayers[cid].transactions`.

### Org-Account (Job/Gang)

**Anlegen beim Start:**
```
Resource Start
  → MySQL: SELECT * FROM bank_accounts_new
  → cachedAccounts[job] befüllen
  → GetFrameworkGroups() → alle Jobs + Gangs
  → Fehlende Einträge: INSERT INTO bank_accounts_new
```

- Existiert für jeden konfigurierten Job und Gang automatisch.
- Wird **nie** gelöscht (außer manuell in der DB).
- `creator = NULL` immer.

### Shared-Account

**Erstellen durch Spieler:**
```
Client: krgsh_banking:client:createAccountMenu
  → Input: account-id (lowercase, no spaces)
  → Server: krgsh_banking:server:createNewAccount
  → Validierung: cachedAccounts[id] darf nicht existieren
  → cachedAccounts[id] anlegen
  → cachedPlayers[cid].accounts erweitern
  → MySQL INSERT
```

**Löschen:**
```
Server: krgsh_banking:server:deleteAccount
  → cachedAccounts[account] = nil
  → cachedPlayers[cid].accounts bereinigen
  → MySQL DELETE
```

**Nur der `creator` kann Shared-Accounts umbenennen und löschen.**

---

## Autorisierungslogik

### Wer sieht welches Konto?

`getBankData(source)` baut den UI-Payload auf:

1. **Personal:** immer eigenes Konto
2. **Job:** `cachedAccounts[job.name]` wenn `IsJobAuth(job.name, job.grade) == true`
3. **Gang:** `cachedAccounts[gang]` wenn `IsGangAuth(Player, gang) == true`
4. **Shared:** alle IDs aus `cachedPlayers[cid].accounts`

### Job-/Gang-Bankberechtigung

| Framework | Bedingung |
|---|---|
| QB/QBX | `grades[grade].bankAuth = true` in `QBCore.Shared.Jobs` / `Gangs` |
| ESX | Grade-Name ist `'boss'` |

### Shared-Account Mitglieder

- `auth`-Map (serverseitig) enthält alle CitizenIDs mit Zugriff.
- `creator` ist der einzige, der Mitglieder hinzufügen/entfernen und umbenennen/löschen darf.
- Mitglieder können das Konto nutzen, aber **nicht** verwalten.

---

## Account-Umbenennung (Rename)

`updateAccountName(account, newName, src)`:

1. Prüfen: alter Account existiert, neuer Name ist frei, Aufrufer ist `creator`
2. `cachedAccounts[newName]` = Deep-Copy von `cachedAccounts[account]`
3. `cachedAccounts[account] = nil`
4. Alle Online-Spieler: `cachedPlayers[cid].accounts` aktualisieren
5. MySQL: `UPDATE bank_accounts_new SET id = newName WHERE id = account`

> **Wichtig:** Transaktionen referenzieren den alten Namen in `title`-Feldern – diese werden **nicht** rückwirkend aktualisiert.

---

## `cachedPlayers` – Spieler-Cache

```lua
cachedPlayers[cid] = {
    isFrozen    = 0,
    transactions = {},      -- array<Transaction>
    accounts     = {}       -- array<string> – Shared-Account-IDs mit Zugriff
}
```

Wird befüllt durch `UpdatePlayerAccount(cid)`:
- Query `player_transactions WHERE id = cid`
- Query `bank_accounts_new WHERE auth LIKE '%cid%'`

---

## Freeze-Flag

Das Feld `isFrozen` ist in der DB und im Cache vorhanden, wird aber **nicht als harte Sperrlogik** in Buchungsoperationen erzwungen. Es dient aktuell hauptsächlich als Anzeige-Flag in der UI (`Account Status: Frozen`).
