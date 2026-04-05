# Server-Exports und öffentliche API

## Überblick

Die Resource stellt eine öffentliche Server-API über Lua-Exports bereit. Diese können von jeder anderen FiveM-Resource auf dem Server genutzt werden.

---

## Exports-Übersicht

| Export | Typ | Beschreibung |
|---|---|---|
| `handleTransaction` | Funktion | Buchung erfassen und persistieren |
| `getAccountMoney` | Funktion | Kontostand abfragen |
| `addAccountMoney` | Funktion | Geld auf ein Konto einzahlen |
| `removeAccountMoney` | Funktion | Geld von einem Konto abziehen |
| `GetJobAccount` | Funktion | Org-Account aus Cache holen |
| `CreateJobAccount` | Funktion | Neues Org-Konto anlegen |
| `addAccountMember` | Funktion | Mitglied zu Shared-Account hinzufügen |
| `removeAccountMember` | Funktion | Mitglied aus Shared-Account entfernen |
| `getAccountTransactions` | Funktion | Transaktionsliste abrufen |
| `changeAccountName` | Funktion | Account umbenennen |

---

## Detaillierte API-Referenz

### `handleTransaction`

```lua
exports['Renewed-Banking']:handleTransaction(
    account,    -- string: Job-Name oder CitizenID
    title,      -- string: Buchungstitel
    amount,     -- number: Betrag
    message,    -- string: Verwendungszweck
    issuer,     -- string: Buchender (Name oder Account)
    receiver,   -- string: Empfänger (Name oder Account)
    transType,  -- string: "deposit" oder "withdraw"
    transID     -- string? (optional): erzwingt bestimmte UUID
)
-- Rückgabe: transaction<table> oder nil
```

**Rückgabe-Objekt:**
```lua
{
    trans_id   = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx",
    title      = "...",
    amount     = 500,
    trans_type = "deposit",
    receiver   = "Max Mustermann",
    message    = "Gehaltszahlung",
    issuer     = "POLICE / police",
    time       = 1712345678
}
```

**Verwendungsbeispiel:**
```lua
-- In einem Gehaltszahlungs-Script:
exports['Renewed-Banking']:handleTransaction(
    Player.PlayerData.citizenid,
    "Personal Account / " .. Player.PlayerData.citizenid,
    2500,
    "Wochenlohn Polizei",
    "LSPD",
    Player.PlayerData.charinfo.firstname .. " " .. Player.PlayerData.charinfo.lastname,
    "deposit"
)
```

---

### `getAccountMoney`

```lua
exports['Renewed-Banking']:getAccountMoney(account)
-- account: string – Job-Name oder Custom-Account-Name
-- Rückgabe: number (Kontostand) oder false (Account nicht gefunden)
```

---

### `addAccountMoney`

```lua
exports['Renewed-Banking']:addAccountMoney(account, amount)
-- account: string
-- amount:  number
-- Rückgabe: true (Erfolg) oder false (Account nicht gefunden)
```

**Intern:** Aktualisiert `cachedAccounts[account].amount` und persistiert in DB.

---

### `removeAccountMoney`

```lua
exports['Renewed-Banking']:removeAccountMoney(account, amount)
-- account: string
-- amount:  number
-- Rückgabe: true (Erfolg) oder false (nicht genug Guthaben / Account nicht gefunden)
```

**Intern:** Prüft `cachedAccounts[account].amount >= amount` vor dem Abzug.

---

### `GetJobAccount`

```lua
exports['Renewed-Banking']:GetJobAccount(jobName)
-- jobName: string – nicht-leerer Job-Name
-- Rückgabe: account<table> oder nil
```

Gibt den vollständigen Account-Table aus dem Cache zurück. Wirft einen Fehler bei ungültigem `jobName`.

---

### `CreateJobAccount`

```lua
exports['Renewed-Banking']:CreateJobAccount(job, initialBalance)
-- job: { name: string, label: string }
-- initialBalance: number? (optional, Standard: 0)
-- Rückgabe: account<table>
```

Erstellt ein Org-Konto für einen Job (z.B. wenn ein neuer Job zur Laufzeit registriert wird). Wenn das Konto bereits existiert, wird es zurückgegeben ohne Duplikat anzulegen.

**Fehler:** Wirft Lua-Error bei ungültigen Parametern oder DB-Fehler.

```lua
-- Beispiel:
local account = exports['Renewed-Banking']:CreateJobAccount(
    { name = "mechanic", label = "Mechanic Workshop" },
    10000  -- Startguthaben
)
```

---

### `addAccountMember`

```lua
exports['Renewed-Banking']:addAccountMember(account, member)
-- account: string – Account-ID
-- member:  string – CitizenID des Spielers
-- Kein Rückgabewert
```

> **Sicherheitshinweis:** Dieser Export führt keinen Creator-Check durch – nur für vertrauenswürdige Server-Backends verwenden.

---

### `removeAccountMember`

```lua
exports['Renewed-Banking']:removeAccountMember(account, member)
-- account: string – Account-ID
-- member:  string – CitizenID des Spielers
-- Kein Rückgabewert
```

---

### `getAccountTransactions`

```lua
exports['Renewed-Banking']:getAccountTransactions(account)
-- account: string – Job-Name, Custom-Account-ID oder CitizenID
-- Rückgabe: transaction[] oder false
```

Unterstützt sowohl `cachedAccounts` (Org/Shared) als auch `cachedPlayers` (Personal).

---

### `changeAccountName`

```lua
exports['Renewed-Banking']:changeAccountName(account, newName)
-- account: string – aktueller Account-Name
-- newName: string – neuer Account-Name
-- Rückgabe: true (Erfolg) oder false
```

> **Sicherheitshinweis:** Dieser Export ignoriert den Creator-Check (kein `src` übergeben) – nur für vertrauenswürdige Server-Backends verwenden.

---

## QB-Management Kompatibilität

```lua
-- Externe Ressourcen können weiterhin nutzen:
exports['qb-management']:GetAccount(account)    → getAccountMoney
exports['qb-management']:AddMoney(account, amt) → addAccountMoney
exports['qb-management']:RemoveMoney(account, amt) → removeAccountMoney
exports['qb-management']:GetGangAccount(account) → getAccountMoney
exports['qb-management']:AddGangMoney(account, amt) → addAccountMoney
exports['qb-management']:RemoveGangMoney(account, amt) → removeAccountMoney
```

---

## ESX-Society Kompatibilität

```lua
exports['esx_society']:GetSociety(account) → getAccountMoney
TriggerServerEvent('esx_society:depositMoney', account, amt)  → addAccountMoney
TriggerServerEvent('esx_society:withdrawMoney', account, amt) → removeAccountMoney
```

---

## Net-Events (intern, nicht für externe Nutzung)

| Event | Richtung | Beschreibung |
|---|---|---|
| `krgsh_banking:server:createNewAccount` | C→S | Neuen Shared-Account erstellen |
| `krgsh_banking:server:getPlayerAccounts` | C→S | Eigene Accounts abrufen |
| `krgsh_banking:server:viewMemberManagement` | C→S | Mitgliederliste anfordern |
| `krgsh_banking:server:addAccountMember` | C→S | Mitglied hinzufügen |
| `krgsh_banking:server:removeAccountMember` | C→S | Mitglied entfernen |
| `krgsh_banking:server:deleteAccount` | C→S | Account löschen |
| `krgsh_banking:server:changeAccountName` | C→S | Account umbenennen |
| `krgsh_banking:client:openBankUI` | S→C / intern | Bank-UI öffnen |
| `krgsh_banking:client:sendNotification` | S→C | UI-Benachrichtigung |
| `krgsh_banking:client:accountsMenu` | S→C | Account-Liste für Menü |
| `krgsh_banking:client:viewMemberManagement` | S→C | Mitglieder-Menü |

## lib.callback (intern)

| Callback | Beschreibung |
|---|---|
| `krgsh_banking:server:initalizeBanking` | Bankdaten für UI laden |
| `krgsh_banking:server:deposit` | Einzahlung verarbeiten |
| `krgsh_banking:server:withdraw` | Abhebung verarbeiten |
| `krgsh_banking:server:transfer` | Überweisung verarbeiten |
