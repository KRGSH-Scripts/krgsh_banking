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
    auth        = { ["CID123"] = true },   -- map<citizenid, true> (nur org/shared; Legacy-Mitglieder)
    creator     = "CID123" or nil,         -- string|nil (nur shared accounts)
    cards       = { { id = "uuid", pinHash = "..." } }  -- nur serverseitig; JSON in DB `cards`
}
```

### Bankkarten (Shared-Zugriff)

- Aktive Karten pro Shared-Konto liegen in `bank_accounts_new.cards` (JSON-Array mit `id` und optionalem `pinHash`).
- **Inhaber** (`creator`): Zugriff immer ohne Karte.
- **Legacy:** weiterhin Zugriff, wenn die eigene CitizenID in `auth` steht (wie zuvor).
- **Karteninhaber:** gültiges Item `Config.bankCardItem` im Inventar mit Metadaten `accountId` + `cardId`, die zu einem Eintrag in `cards` passen; optionale **PIN** pro Karte (gebunden an die Karte, Sitzung serverseitig nach erfolgreicher Eingabe).
- `deposit` / `withdraw` / `transfer` (vom Org-/Shared-Konto) prüfen serverseitig `canUseCachedAccountForBanking`.
- UI-Payload enthält **keine** `auth`- oder `cards`-Details (werden beim Klonen für die NUI entfernt). Konten mit offener PIN zeigen `needsBankCardPin` + `bankCardId` bis zur Verifikation.

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
Client: krgsh_banking:client:createAccountMenu ODER NUI „Konto anlegen“
  → Input: Anzeigename (display_label)
  → Server: lib.callback krgsh_banking:server:createSharedAccount
  → Server generiert eindeutige Kontonummer (PK id), Ziffernlänge = `personalIdLen(cid) + 1` (max. 21)
  → cachedAccounts[id] anlegen, display_label persistiert
  → cachedPlayers[cid].accounts erweitern
  → MySQL INSERT
```

**Schließen / Löschen:**
```
Server: krgsh_banking:server:deleteAccount
  → nur `creator`, optional Kontostand 0 (`Config.requireZeroBalanceToClose`)
  → `cachedPlayers` für alle `auth`-CitizenIDs bereinigen; PIN-Sitzungen zum Konto verwerfen
  → cachedAccounts[account] = nil
  → MySQL DELETE (inkl. `cards`)
```

**Nur der `creator` kann Shared-Accounts umbenennen und schließen.**

---

## Autorisierungslogik

### Wer sieht welches Konto?

`getBankData(source)` baut den UI-Payload auf:

1. **Personal:** immer eigenes Konto
2. **Job:** `cachedAccounts[job.name]` wenn `IsJobAuth(job.name, job.grade) == true`
3. **Gang:** `cachedAccounts[gang]` wenn `IsGangAuth(Player, gang) == true`
4. **Shared:** Vereinigung aus `cachedPlayers[cid].accounts` (Legacy `auth LIKE`) **und** Konten, zu denen der Spieler eine **gültige Bankkarte** im Inventar hat (`server/inventory_cards.lua` + `Config.inventoryProvider`)

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

`updateAccountName(account, newLabel, src)` (nur Shared-Accounts mit `creator`):

1. Prüfen: Account existiert, Anzeigename 1–100 Zeichen, Aufrufer ist `creator` (wenn `src` gesetzt)
2. `cachedAccounts[account].name` und `display_label` setzen
3. MySQL: `UPDATE bank_accounts_new SET display_label = ? WHERE id = ?` (PK `id` bleibt stabil)

> **Wichtig:** Transaktionen referenzieren ggf. ältere Namen in `title`-Feldern – diese werden **nicht** rückwirkend aktualisiert.

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
