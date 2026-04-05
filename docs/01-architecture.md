---
title: "Systemarchitektur"
description: "Gesamtarchitektur von krgsh_banking: Schichtenmodell, Dateistruktur und technischer Überblick über alle Resource-Bestandteile."
tags: ["fivem", "banking", "architecture", "lua"]
order: 1
---

# Systemarchitektur – krgsh_banking

## Überblick

`krgsh_banking` ist eine FiveM-Resource (Lua 5.4) für ein vollständiges Banking-System, das auf **QBCore**, **QBX** und **ESX** läuft. Die Resource besteht aus einem Lua-Backend (Client + Server), einer Browser-basierten NUI (React/Vite; Source unter `web/src`, ausgelieferter Build unter `web/public/`) und einer MySQL-Datenbank via `oxmysql`. Upstream: [Renewed-Banking](https://github.com/Renewed-Scripts/Renewed-Banking).

---

## Schichtenmodell

```
┌─────────────────────────────────────────────────────────────┐
│  NUI / Browser (web/public/index.html + assets/*)           │
│  React / Vite · Build erforderlich (siehe build.sh)          │
└────────────────────────┬────────────────────────────────────┘
                         │  NUI-Messages (window.onmessage)
                         │  NUI-Callbacks (fetch POST)
┌────────────────────────▼────────────────────────────────────┐
│  CLIENT-LAYER (Lua)                                          │
│  client/framework.lua  – Framework-Erkennung, Player-Hooks  │
│  client/main.lua       – NUI, ox_target, Peds, Blips        │
│  client/menus.lua      – ox_lib Context-Menüs               │
└────────────────────────┬────────────────────────────────────┘
                         │  lib.callback / TriggerServerEvent
┌────────────────────────▼────────────────────────────────────┐
│  SERVER-LAYER (Lua)                                          │
│  server/framework.lua  – Adapter: QB/QBX/ESX                │
│  server/main.lua       – Buchungslogik, Cache, DB, Exports  │
└────────────────────────┬────────────────────────────────────┘
                         │  oxmysql (async/await)
┌────────────────────────▼────────────────────────────────────┐
│  DATENBANK (MySQL)                                           │
│  bank_accounts_new     – Org/Shared-Konten                  │
│  player_transactions   – Persönliche Buchungshistorie       │
└─────────────────────────────────────────────────────────────┘
```

---

## Dateistruktur

```
krgsh_banking/
├── fxmanifest.lua          Resource-Manifest (Dependencies, Scripts, UI)
├── config.lua              Konfigurationsdatei (Config-Table)
├── client/
│   ├── framework.lua       Framework-Erkennung + Player-Lifecycle Client
│   ├── main.lua            NUI-Handler, ox_target, Ped-Lifecycle, Blips
│   └── menus.lua           ox_lib Context-Menüs für Account-Verwaltung
├── server/
│   ├── framework.lua       Framework-Adapter + Kompatibilitäts-Exports
│   └── main.lua            Kern-Business-Logik, Cache, API, Exports
├── web/
│   ├── src/                React/TS-Quellen (Vite)
│   └── public/             Ausgelieferte NUI (index.html, assets/* nach Build)
├── locales/                22 Sprachdateien (JSON)
└── krgsh_banking.sql       SQL-Schema (Tabellendefinitionen)
```

---

## Abhängigkeiten

| Abhängigkeit | Zweck                                                      |
|--------------|------------------------------------------------------------|
| `oxmysql`    | MySQL-Datenbankzugriff (async Queries, Transactions)       |
| `ox_lib`     | Callbacks, Notifications, Context-Menüs, Input-Dialoge, Locale, Points |
| `ox_target`  | Interaktions-Targets für ATMs und Bank-Peds               |

---

## Framework-Kompatibilität

Die Resource **erkennt das aktive Framework automatisch** beim Start:

```lua
local Framework = GetResourceState('es_extended') == 'started' and 'esx'
    or GetResourceState('qbx_core') == 'started' and 'qbx'
    or GetResourceState('qb-core') == 'started' and 'qb'
    or 'Unknown'
```

Priorität: ESX > QBX > QBCore. Bei `Unknown` stoppt die Resource.

Alle framework-spezifischen Aufrufe sind vollständig in `server/framework.lua` und `client/framework.lua` gekapselt. Das Kern-System in `server/main.lua` und die UI sind framework-agnostisch.

---

## Kompatibilitäts-Shims

Die Resource stellt folgende Shims bereit, damit externe Ressourcen ohne Anpassung weiterarbeiten können:

- `provide 'qb-management'` → Exports `GetAccount`, `AddMoney`, `RemoveMoney`, `GetGangAccount`, `AddGangMoney`, `RemoveGangMoney`
- `provide 'esx_society'` → Export `GetSociety` + Server-Events `getSociety`, `depositMoney`, `withdrawMoney`

---

## Ressource-Name

Der **Ordnername** der Resource muss zu `ensure <name>` in der `server.cfg` passen. Die NUI verwendet `GetParentResourceName()` für `fetch('https://<name>/…')`. Der Server prüft beim Start, ob `web/public/index.html` vorhanden ist.

---

## Weitere Systemdokumentationen

| Dokument | Inhalt |
|---|---|
| [02-framework-adapter.md](./02-framework-adapter.md) | Framework-Adapter und -Erkennung |
| [03-account-system.md](./03-account-system.md) | Kontenmodell und Lebenszyklen |
| [04-transaction-system.md](./04-transaction-system.md) | Buchungslogik (Deposit, Withdraw, Transfer) |
| [05-cache-system.md](./05-cache-system.md) | Server-seitiger In-Memory-Cache |
| [06-nui-ui.md](./06-nui-ui.md) | Frontend / NUI-Dokumentation |
| [07-ped-atm-interaction.md](./07-ped-atm-interaction.md) | Peds, ATMs, ox_target, Blips |
| [08-account-management.md](./08-account-management.md) | Shared-Account-Verwaltungsmenüs |
| [09-localization.md](./09-localization.md) | Lokalisierungssystem |
| [10-exports-api.md](./10-exports-api.md) | Server-Exports und öffentliche API |
| [11-database-schema.md](./11-database-schema.md) | Datenbankschema |
| [12-config.md](./12-config.md) | Konfigurationsreferenz |
