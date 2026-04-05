# Shared-Account-Verwaltungsmenüs

## Überblick

Die Verwaltung von Shared-Accounts (Erstellen, Umbenennen, Löschen, Mitgliederverwaltung) erfolgt über ein **ox_lib Context-Menü-System**. Diese Menüs sind nur an Bank-Peds mit `createAccounts = true` zugänglich.

---

## Menü-Hierarchie

```
accountManagmentMenu         (Hauptmenü)
├── createAccountMenu        (Account erstellen – Input-Dialog)
└── accountsMenu             (Kontoliste – Server-seitig gefüllt)
    └── accountsMenuView     (Einzelkonto-Aktionen)
        ├── viewMemberManagement  (Mitgliederliste)
        │   ├── addAccountMember  (Mitglied hinzufügen – Input-Dialog)
        │   └── removeMemberConfirmation  (Mitglied entfernen – Bestätigung)
        ├── changeAccountName      (Umbenennen – Input-Dialog)
        └── deleteAccount          (Löschen – direkt)
```

---

## Menü-Details

### Hauptmenü: `accountManagmentMenu`

**Auslöser:** ox_target-Interaktion an Bank-Ped (Event: `krgsh_banking:client:accountManagmentMenu`)

```lua
lib.registerContext({
    id = 'renewed_banking_account_management',
    title = locale("bank_name"),
    position = 'top-right',
    options = {
        { title = locale("create_account"),  event = "krgsh_banking:client:createAccountMenu" },
        { title = locale("manage_account"),  event = 'krgsh_banking:client:viewAccountsMenu'  }
    }
})
```

---

### Account erstellen: `createAccountMenu`

Input-Dialog mit einem Feld:
- Typ: `input`, Placeholder: `"a_test_account"`
- Normalisierung: `.lower():gsub("%s+", "")` – alles Klein, keine Leerzeichen

```lua
TriggerServerEvent("krgsh_banking:server:createNewAccount", input[1])
```

**Server-Validierung:**
- `cachedAccounts[accountid]` darf nicht existieren
- Erstellt Konto mit `creator = cid`, `auth = { [cid] = true }`

---

### Kontoliste: `accountsMenu`

**Flow:**
1. Client triggert `krgsh_banking:server:getPlayerAccounts`
2. Server: filtert `cachedPlayers[cid].accounts` → nur Konten, bei denen `creator == cid`
3. Server: `TriggerClientEvent("krgsh_banking:client:accountsMenu", source, data)`
4. Client: Menü mit Account-Namen als Optionen rendern

Wenn keine Konten vorhanden: Hinweis "Account Not Found – You need to be the creator"

---

### Einzelkonto-Aktionen: `accountsMenuView`

Drei Aktionen:
| Aktion | Event/ServerEvent |
|---|---|
| Mitglieder verwalten | `serverEvent: krgsh_banking:server:viewMemberManagement` |
| Name ändern | `event: krgsh_banking:client:changeAccountName` |
| Account löschen | `serverEvent: krgsh_banking:server:deleteAccount` |

**Back-Navigation:** `menu = "renewed_banking_account_list"` – ox_lib zeigt Zurück-Button

---

### Mitgliederverwaltung: `viewMemberManagement`

**Server-Flow:**
1. `krgsh_banking:server:viewMemberManagement` empfangen
2. `cachedAccounts[account].auth` iterieren
3. Für jede CitizenID: `getPlayerData` aufrufen → Spielername holen
4. Eigene CID aus der Anzeige herausfiltern
5. `{ account, members: { [cid] = "Name" } }` an Client

**Client:** Menü mit Mitgliedernamen + "Mitglied hinzufügen" am Ende

---

### Mitglied hinzufügen: `addAccountMember`

Input-Dialog:
- Label: `locale('citizen_id')`
- Placeholder: `"1001"`
- Normalisierung: `.upper():gsub("%s+", "")` – alles Groß, keine Leerzeichen

```lua
TriggerServerEvent('krgsh_banking:server:addAccountMember', data.account, input[1])
```

**Server-Validierung:**
- Aufrufer **muss** `creator` sein (sonst: "illegal_action" Log)
- `getPlayerData(source, member)` – Spieler muss online sein
- `cachedAccounts[account].auth[cid] = true`
- `cachedPlayers[targetCID].accounts` ergänzen (wenn online)
- DB: `UPDATE bank_accounts_new SET auth = ? WHERE id = ?`

---

### Mitglied entfernen: `removeMemberConfirmation`

Zwischenschritt-Menü zur Bestätigung:
```lua
{
    title = locale('remove_member'),
    metadata = {locale('remove_member_txt2', data.cid)},   -- "CitizenID: X; No going back."
    serverEvent = 'krgsh_banking:server:removeAccountMember',
    args = data  -- { account, cid }
}
```

**Server-Validierung:**
- Aufrufer **muss** `creator` sein
- Auth-Map und cachedPlayers-Accounts bereinigen
- DB aktualisieren

---

### Account umbenennen: `changeAccountName`

Input-Dialog:
- Label: `locale('account_id')`
- Placeholder: `"savings-1001"`
- Normalisierung: `.lower():gsub("%s+", "")`

```lua
TriggerServerEvent('krgsh_banking:server:changeAccountName', data.account, input[1])
```

Ruft serverseitig `updateAccountName(account, newName, source)` auf.

---

### Account löschen: `deleteAccount`

Kein Bestätigungsschritt auf Client-Seite! Direkter `serverEvent`-Aufruf.

**Server:** `cachedAccounts[account] = nil` + DB DELETE + `cachedPlayers[cid].accounts` bereinigen

> **Refactoring-Hinweis:** Ein Bestätigungs-Dialog vor dem Löschen wäre empfehlenswert.

---

## Sicherheitskonzept der Menüs

| Schutz | Implementierung |
|---|---|
| Creator-Check | Serverseitig: `GetIdentifier(Player) ~= cachedAccounts[account].creator` |
| Illegal-Action-Log | `print(locale("illegal_action", GetPlayerName(source)))` + frühzeitiger Return |
| Online-Pflicht | `getPlayerData` schlägt fehl wenn Spieler offline → Aktion abgebrochen |
| Input-Normalisierung | Client-seitig (Komfort), Validierung serverseitig |
