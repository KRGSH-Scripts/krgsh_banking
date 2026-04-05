# Datenbankschema

## Überblick

Die Resource verwendet zwei MySQL-Tabellen. Das Schema wird sowohl durch `Renewed-Banking.sql` als auch automatisch beim Ressourcen-Start durch `server/main.lua` angelegt (`CREATE TABLE IF NOT EXISTS`).

---

## Tabelle: `bank_accounts_new`

Speichert alle Org-Konten (Jobs, Gangs) und Shared-Konten.

```sql
CREATE TABLE IF NOT EXISTS `bank_accounts_new` (
  `id`             varchar(50)  NOT NULL,
  `amount`         int(11)      DEFAULT 0,
  `transactions`   longtext     DEFAULT '[]',
  `auth`           longtext     DEFAULT '[]',
  `isFrozen`       int(11)      DEFAULT 0,
  `creator`        varchar(50)  DEFAULT NULL,
  `display_label`  varchar(100) DEFAULT NULL,
  PRIMARY KEY (`id`)
);
```

### Felder

| Feld | Typ | Beschreibung |
|---|---|---|
| `id` | varchar(50) | Eindeutige Account-ID (Job-/Gang-Name oder servergenerierte Shared-Kontonummer) |
| `amount` | int(11) | Aktueller Kontostand in der konfigurierten Währung |
| `transactions` | longtext | JSON-Array von Transaction-Objekten (neueste zuerst) |
| `auth` | longtext | JSON-Array von CitizenIDs mit Kontozugriff |
| `isFrozen` | int(11) | 0 = aktiv, 1 = eingefroren |
| `creator` | varchar(50) | CitizenID des Erstellers (nur Shared-Accounts, NULL für Org) |
| `display_label` | varchar(100) | Anzeigename für Shared-Konten (optional; Jobs nutzen Framework-Label) |

### Transaktions-JSON-Format

```json
[
    {
        "trans_id":   "a1b2c3d4-...-xxxx",
        "title":      "Personal Account / CID123",
        "amount":     500,
        "trans_type": "deposit",
        "receiver":   "Max Mustermann",
        "message":    "Gehaltszahlung",
        "issuer":     "LSPD",
        "time":       1712345678
    }
]
```

### Auth-JSON-Format

```json
["CID123", "CID456", "CID789"]
```

Wird im Cache als Map umgewandelt: `{ ["CID123"] = true, ... }`

---

## Tabelle: `player_transactions`

Speichert persönliche Buchungshistorien der Spieler.

```sql
CREATE TABLE IF NOT EXISTS `player_transactions` (
  `id`           varchar(50)  NOT NULL,
  `isFrozen`     int(11)      DEFAULT 0,
  `transactions` longtext     DEFAULT '[]',
  PRIMARY KEY (`id`)
);
```

### Felder

| Feld | Typ | Beschreibung |
|---|---|---|
| `id` | varchar(50) | CitizenID (QB/QBX) oder ESX-Identifier des Spielers |
| `isFrozen` | int(11) | 0 = aktiv, 1 = eingefroren (aktuell kaum genutzt) |
| `transactions` | longtext | JSON-Array von Transaction-Objekten (gleiches Format wie oben) |

---

## Typische Datenbankoperationen

### Initialer Account-Load

```sql
SELECT * FROM bank_accounts_new
```

### Account-Balance aktualisieren

```sql
UPDATE bank_accounts_new SET amount = ? WHERE id = ?
```

### Transaktionen persistieren

```sql
INSERT INTO bank_accounts_new (id, transactions)
VALUES (?, ?)
ON DUPLICATE KEY UPDATE transactions = ?

INSERT INTO player_transactions (id, transactions)
VALUES (?, ?)
ON DUPLICATE KEY UPDATE transactions = ?
```

### Auth-Mitglieder aktualisieren

```sql
UPDATE bank_accounts_new SET auth = ? WHERE id = ?
```

### Account umbenennen

```sql
UPDATE bank_accounts_new SET id = ? WHERE id = ?
```

### Account löschen

```sql
DELETE FROM bank_accounts_new WHERE id = :id
```

### Shared-Accounts eines Spielers finden

```sql
SELECT * FROM bank_accounts_new WHERE auth LIKE ?
-- Parameter: '%CID123%'
```

---

## Batch-Operationen beim Start

Fehlende Job/Gang-Konten werden in einer Transaktion angelegt:

```lua
MySQL.transaction.await(query)  -- Array von INSERT-Statements
```

---

## Schema-Hinweise für Refactoring

1. **`transactions` als longtext:** Bei sehr aktiven Konten kann das JSON-Feld sehr groß werden. Eine separate Transaktions-Tabelle würde die Performance verbessern.

2. **`auth` LIKE-Suche:** Die Suche nach Spieler-Konten über `WHERE auth LIKE '%cid%'` ist nicht indexierbar. Eine Relation-Tabelle (account_members) wäre skalierbarer.

3. **`amount` als int:** Keine Nachkommastellen möglich. Bei Bedarf auf `DECIMAL(15,2)` wechseln.

4. **Keine Fremdschlüssel:** Die Tabellen haben keine referentiellen Integritätsbedingungen. Gelöschte Konten hinterlassen keine Waiseneinträge, da das System Cache-First arbeitet.

5. **Doppelverantwortung:** Tabellen werden sowohl durch `Renewed-Banking.sql` als auch durch `server/main.lua` (`CREATE TABLE IF NOT EXISTS`) angelegt. Dies ist idempotent, aber redundant.

---

## Migrations-Hinweise

Bei Schemaänderungen:
1. `Renewed-Banking.sql` aktualisieren
2. Migration in `server/main.lua` ergänzen (ALTER TABLE im CreateThread)
3. Cache-Strukturen und JSON-Decoder anpassen
4. Rückwärtskompatibilität der JSON-Felder sicherstellen (alte Einträge können fehlende Felder haben)
