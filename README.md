# Renewed-Banking / krgsh_banking

<a href='https://ko-fi.com/ushifty' target='_blank'><img height='35' style='border:0px;height:46px;' src='https://az743702.vo.msecnd.net/cdn/kofi3.png?v=0' border='0' alt='Buy Me a Coffee at ko-fi.com' /></a>

[Renewed Discord](https://discord.gg/P3RMrbwA8n)

---

## Projektbeschreibung

Vollständiges FiveM-Banking-System für **QBCore**, **QBX** und **ESX**. Entwickelt und gepflegt von uShifty#1733. Das 2.0 UI wurde von [qwadebot](https://github.com/qw-scripts) neu gestaltet und von [uShifty](https://github.com/uShifty) angepasst.

---

## Abhängigkeiten

- [oxmysql](https://github.com/overextended/oxmysql)
- [ox_lib](https://github.com/overextended/ox_lib)
- [ox_target](https://github.com/overextended/ox_target)

---

## Features

- Personal-, Job-, Gang- und Shared-Konten
- Einzahlen, Abheben, Überweisen zwischen allen Kontotypen
- Multi-Theme UI (DEFAULT, FLEECA, MAZE BANK) – pro ATM/Ped konfigurierbar
- 22 Sprachunterstützung
- Optimierte Resource (0.00ms im Leerlauf)
- `/givecash` Kommando (Bargeld-Transfer zwischen Spielern)
- Vollständiges Buchungsjournal mit Suchfunktion

---

## Installation

1. SQL aus `Renewed-Banking.sql` in die Datenbank einspielen
2. Resource-Name **muss** `Renewed-Banking` bleiben (UI-Check)
3. Framework-spezifische Schritte (QBCore) s.u.

---

## QBCore: Zusätzliche Installationsschritte

### Society-Bank-Zugriff

In `QBCore/Shared/jobs.lua` und `QBCore/Shared/gangs.lua` allen Grades mit Bankzugriff hinzufügen:

```lua
bankAuth = true
```

### qb-management Migration

```lua
exports['qb-management']:GetAccount      → exports['Renewed-Banking']:getAccountMoney
exports['qb-management']:AddMoney        → exports['Renewed-Banking']:addAccountMoney
exports['qb-management']:RemoveMoney     → exports['Renewed-Banking']:removeAccountMoney
exports['qb-management']:GetGangAccount  → exports['Renewed-Banking']:getAccountMoney
exports['qb-management']:AddGangMoney    → exports['Renewed-Banking']:addAccountMoney
exports['qb-management']:RemoveGangMoney → exports['Renewed-Banking']:removeAccountMoney
```

---

## Server-Exports (externe Integration)

```lua
-- Buchung erfassen
exports['Renewed-Banking']:handleTransaction(account, title, amount, message, issuer, receiver, type, transID)
-- @param account  string  – Job-Name oder CitizenID
-- @param title    string  – Buchungstitel
-- @param amount   number  – Betrag
-- @param message  string  – Verwendungszweck
-- @param issuer   string  – Buchender (Name oder Konto)
-- @param receiver string  – Empfänger (Name oder Konto)
-- @param type     string  – "deposit" | "withdraw"
-- @param transID  string? – (optional) erzwingt eine bestimmte UUID
-- @return transaction<table>

-- Kontostand abfragen
exports['Renewed-Banking']:getAccountMoney(account)
-- @return number | false

-- Geld einzahlen
exports['Renewed-Banking']:addAccountMoney(account, amount)
-- @return boolean

-- Geld abziehen
exports['Renewed-Banking']:removeAccountMoney(account, amount)
-- @return boolean

-- Job-Konto anlegen
exports['Renewed-Banking']:CreateJobAccount({ name, label }, initialBalance?)
-- @return account<table>

-- Job-Konto abrufen
exports['Renewed-Banking']:GetJobAccount(jobName)
-- @return account<table> | nil

-- Transaktionsliste abrufen
exports['Renewed-Banking']:getAccountTransactions(account)
-- @return transaction[] | false
```

Vollständige API-Referenz: [docs/10-exports-api.md](docs/10-exports-api.md)

---

## Technische Dokumentation

| Dokument | Beschreibung |
|---|---|
| [docs/01-architecture.md](docs/01-architecture.md) | Gesamtarchitektur, Schichtenmodell, Dateistruktur |
| [docs/02-framework-adapter.md](docs/02-framework-adapter.md) | Framework-Erkennung (QB/QBX/ESX), Adapter-Funktionen, Kompatibilitäts-Shims |
| [docs/03-account-system.md](docs/03-account-system.md) | Kontentypen (Personal/Org/Shared), Datenmodell, Autorisierungslogik |
| [docs/04-transaction-system.md](docs/04-transaction-system.md) | Buchungslogik: Deposit, Withdraw, Transfer, /givecash |
| [docs/05-cache-system.md](docs/05-cache-system.md) | Server-seitiger In-Memory-Cache, Initialisierung, Invalidierung |
| [docs/06-nui-ui.md](docs/06-nui-ui.md) | Frontend-Architektur, NUI-Message-Protokoll, Theming, Tabs, Komponenten |
| [docs/07-ped-atm-interaction.md](docs/07-ped-atm-interaction.md) | ATMs, Bank-Peds, lib.points, ox_target, Blips, Öffnungsablauf |
| [docs/08-account-management.md](docs/08-account-management.md) | Shared-Account-Menüs: Erstellen, Umbenennen, Löschen, Mitgliederverwaltung |
| [docs/09-localization.md](docs/09-localization.md) | Locale-System, 22 Sprachen, Schlüssel-Referenz, NUI-Integration |
| [docs/10-exports-api.md](docs/10-exports-api.md) | Vollständige Export-API, Net-Events, Callbacks |
| [docs/11-database-schema.md](docs/11-database-schema.md) | Tabellenschema, JSON-Formate, SQL-Operationen, Migrations-Hinweise |
| [docs/12-config.md](docs/12-config.md) | Vollständige Konfigurationsreferenz (config.lua) |
| [docs/13-subscription-api.md](docs/13-subscription-api.md) | Subscription-API: Exports, `external_id`, Server-Events (`TriggerEvent`) |

---

## Changelog

<details>
<summary>Versionshistorie anzeigen</summary>

**V2.0.0**
```
New UI Design
ESX Support Added
QB Dependencies switched to OX
Massive server side optimizations
Rework initial codebase
Delete created accounts
```

**V1.0.5**
```
Fix OX integration being ATM only
Added Renewed Phones MultiJob Support (Enable in config)
Fix onResourceStop errors for QB target users
Fixed a couple Account Menu bugs from 1.0.4 OX integration
Slight client side cleanup
Fix exploit allowing players to hijack sub accounts
```

**v1.0.4**
```
Add server export to get an accounts transactions.
Add /givecash command
Added ox lib and target support
```

**V1.0.3**
```
Fixes the default message when no message is provided when transferring
Added Bank Checks for those who don't like to configure their QBCore
Added a check to ensure player cache exists
Fixed bug with shared accounts and entering a negative value
```

**V1.0.2**
```
Added Gangs To SQL
Disabled Deposit At ATM Machines
Fix Error "Form Submission Canceled"
QBCore Locale System Implementation
Implemented Translations To UI (No Need To Edit UI Anymore)
Fix Balance & Transactions Update
Fix Transaction Default Message
```

**V1.0.1**
```
Added Banking Blips
```

</details>
