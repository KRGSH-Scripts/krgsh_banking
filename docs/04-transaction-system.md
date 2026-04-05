---
title: "Buchungssystem"
description: "Serverseitige Buchungslogik für Einzahlung, Abhebung und Überweisung: Validierung, Transaktionshistorie und NUI-Callback-Flow."
tags: ["fivem", "banking", "lua", "transactions", "api"]
order: 4
---

# Buchungssystem (Transaction System)

## Überblick

Alle Geldtransaktionen (Einzahlung, Abhebung, Überweisung) laufen ausschließlich **serverseitig** ab. Die NUI sendet eine Anfrage, der Server validiert und verbucht, und gibt den aktualisierten Konto-Payload zurück.

---

## Kommunikationsfluss

```
NUI (fetch POST /deposit | /withdraw | /transfer)
  → RegisterNUICallback('deposit'|'withdraw'|'transfer', ...)
  → lib.callback.await('krgsh_banking:server:deposit|withdraw|transfer')
  → Server: Validierung + Buchung
  → Rückgabe: getBankData(source) (kompletter Konto-Payload)
  → NUI: state.accounts aktualisieren + re-render
```

---

## NUI-Payload (vom Client)

```js
{
    fromAccount: "account_id",   // Konto-ID (CitizenID oder Account-Name)
    amount:      500,            // Zahl, vom Server nochmals validiert
    comment:     "Optionaler Verwendungszweck",
    stateid:     "CID123"        // Nur bei Transfer: Ziel-CitizenID oder Konto-ID
}
```

---

## Gemeinsame Validierungsschritte

Bei allen drei Aktionen prüft der Server:
1. `amount = tonumber(data.amount)` – muss ≥ 1 sein
2. `comment` wird automatisch gesetzt wenn leer: `locale("comp_transaction", name, "deposited", amount)`
3. `sanitizeMessage(comment)` – Sonderzeichen escapen (`'` → `''`, `\` → `\\`)

---

## Deposit (Einzahlung)

**Logik:**
```
Bargeldbetrag vom Spieler abziehen (RemoveMoney, Type='cash')
  → Erfolg?
  → Org/Shared: AddAccountMoney(fromAccount, amount)
  → Personal:   AddMoney(Player, amount, 'bank')
  → handleTransaction(fromAccount, ...)
  → getBankData zurückgeben
  → Fehler: Notify "not_enough_money"
```

**Besonderheit:** Einzahlung geht von **Bargeld** auf das gewählte Konto.

---

## Withdraw (Abhebung)

**Logik:**
```
Zielkonto prüfen:
  Org/Shared: RemoveAccountMoney(fromAccount, amount)
  Personal:   funds.bank >= amount AND RemoveMoney(Player, amount, 'bank')
  → Erfolg?
  → AddMoney(Player, amount, 'cash')  [immer Bargeld]
  → handleTransaction(fromAccount, ...)
  → getBankData zurückgeben
  → Fehler: Notify "not_enough_money"
```

**Besonderheit:** Abhebung gibt immer **Bargeld** aus.

---

## Transfer (Überweisung)

Transfer ist die komplexeste Operation und kennt vier Fälle:

### Fall 1: Org → Org/Shared
```
RemoveAccountMoney(fromAccount, amount)
AddAccountMoney(stateid, amount)
handleTransaction(fromAccount, ..., 'withdraw')
handleTransaction(stateid, ..., 'deposit', trans_id)  ← gleiche trans_id
```

### Fall 2: Org → Spieler (CitizenID)
```
RemoveAccountMoney(fromAccount, amount)
GetPlayerObjectFromID(stateid) → Player2 muss online sein
AddMoney(Player2, amount, 'bank')
handleTransaction(fromAccount, ..., 'withdraw')
handleTransaction(stateid, ..., 'deposit', trans_id)
```

### Fall 3: Personal → Org/Shared
```
funds.bank >= amount AND RemoveMoney(Player, amount, 'bank')
AddAccountMoney(stateid, amount)
handleTransaction(fromAccount, ..., 'withdraw')
handleTransaction(stateid, ..., 'deposit', trans_id)
```

### Fall 4: Personal → Spieler (CitizenID)
```
funds.bank >= amount AND RemoveMoney(Player, amount, 'bank')
GetPlayerObjectFromID(stateid) → Player2 muss online sein
AddMoney(Player2, amount, 'bank')
handleTransaction(fromAccount, ..., 'withdraw')
handleTransaction(stateid, ..., 'deposit', trans_id)
```

> **Wichtig:** Überweisungen zu Offline-Spielern sind **nicht möglich**. Der Transfer schlägt mit `locale("fail_transfer")` fehl, wenn der Empfänger offline ist.

---

## handleTransaction – Kern der Buchungserfassung

```lua
handleTransaction(account, title, amount, message, issuer, receiver, transType, transID)
```

| Parameter | Typ | Beschreibung |
|---|---|---|
| `account` | string | Konto-ID (Key in cachedAccounts oder cachedPlayers) |
| `title` | string | Buchungstitel |
| `amount` | number | Betrag |
| `message` | string | Verwendungszweck |
| `issuer` | string | Buchender (Name oder Konto) |
| `receiver` | string | Empfänger (Name oder Konto) |
| `transType` | string | `"deposit"` oder `"withdraw"` |
| `transID` | string? | Optional: erzwingt bestimmte UUID (für verknüpfte Buchungen) |

**Ablauf:**
1. Alle Parameter type-validieren (early return mit Log bei Fehler)
2. UUID generieren falls kein `transID` übergeben: `genTransactionID()` (UUIDv4-Format)
3. Transaction-Objekt erstellen mit `time = os.time()`
4. In entsprechenden Cache einfügen: `table.insert(..., 1, transaction)` (neueste zuerst)
5. DB persistieren via `MySQL.prepare` (INSERT ON DUPLICATE KEY UPDATE)
6. Transaction-Objekt zurückgeben (wird bei Transfer für `transID`-Verknüpfung genutzt)

### Transaction-Objekt

```lua
{
    trans_id   = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx",
    title      = "Personal Account / CID123",
    amount     = 500,
    trans_type = "deposit",   -- oder "withdraw"
    receiver   = "Max Mustermann",
    message    = "Miete",
    issuer     = "POLICE / police",
    time       = 1712345678   -- Unix Epoch
}
```

---

## `/givecash` Kommando

Server-Kommando (via `lib.addCommand`) zum direkten Bargeld-Transfer zwischen Spielern.

**Validierungen:**
- Beide Spieler müssen online sein
- Abstand ≤ 10.0 Einheiten
- Sender darf nicht tot sein
- Betrag ≥ 0

**Ablauf:** `RemoveMoney(Player, amount, 'cash')` → `AddMoney(iPlayer, amount, 'cash')` → beide Spieler benachrichtigen.

---

## Sicherheitshinweise

- `amount` wird serverseitig mit `tonumber()` und `>= 1` validiert – clientseitige Werte werden **nicht vertraut**
- `comment`/`message` werden durch `sanitizeMessage()` gegen SQL-Injection gesäubert
- `stateid` (Transfer-Ziel) wird serverseitig als Konto oder Spieler-Lookup validiert
- Negative Beträge und NaN sind durch `amount < 1`-Check ausgeschlossen
