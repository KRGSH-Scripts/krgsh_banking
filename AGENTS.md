# AGENTS.md

Projektweite Arbeitsanweisungen fuer Codex/Agenten in diesem Repository (`krgsh_banking` / Renewed-Banking Resource).

## Ziel dieses Dokuments
- Einheitliche Regeln fuer Aenderungen an einer FiveM-Banking-Resource (Lua + NUI + SQL + Locales).
- Bestehende Runtime-Kompatibilitaet zu QBCore/QBX/ESX erhalten.
- Domänenmodell, Datenfluss und bestehende Patterns dokumentieren, damit neue Features konsistent gebaut werden.

## Kurzueberblick (Ist-Zustand)
- Typ: FiveM Resource (Lua 5.4) mit NUI (ausgeliefertes gebautes Svelte-Bundle).
- Entry: `fxmanifest.lua`
- Shared Config: `config.lua`
- Client: `client/*.lua`
- Server: `server/*.lua`
- Datenbank: `Renewed-Banking.sql` (wird zusaetzlich in `server/main.lua` auch automatisch erstellt)
- UI Assets: `web/public/index.html`, `web/public/global.css`, `web/public/build/*`
- Lokalisierung: `locales/*.json` (22 Sprachen, aktuell gleiche Key-Menge wie `en.json`)

## Kritische Betriebsregeln (sehr wichtig)
- Ressourcename nicht umbenennen: Die Serverlogik erwartet explizit `Renewed-Banking` fuer UI-Check (`web/public/build/bundle.js`), sonst stoppt die Resource.
- Externe Kompatibilitaet erhalten:
  - `provide 'qb-management'`
  - `provide 'esx_society'`
  - exports/events/callback-Namen nicht aendern, ausser mit Migrationsplan.
- SQL-Schema aendern nur mit Migration und Rueckwaertskompatibilitaet der JSON-Felder (`transactions`, `auth`).

## Projektteile (Parts)
### 1) Resource/Manifest
- `fxmanifest.lua` definiert Dependencies (`ox_lib`, `oxmysql`), Scripts, UI und ausgelieferte Dateien.
- `shared_scripts` laden `@ox_lib/init.lua` und `config.lua`.

### 2) Konfiguration
- `config.lua` enthaelt:
  - Framework-nahe Runtime-Optionen (`renewedMultiJob`, `progressbar`, `currency`)
  - ATM-Modelle (`Config.atms`)
  - Bank-Ped/NPC-Definitionen (`Config.peds` inkl. `coords`, `model`, optional `createAccounts`)
- Neue Config-Werte immer mit sinnvollem Default und Kommentar einfuehren.

### 3) Client-Layer
- `client/framework.lua`
  - Framework-Erkennung (QB/QBX/ESX)
  - Player-Loaded Hooks
  - Initialisierung der Banking-UI-Locale-Daten und Ped-Erzeugung
- `client/main.lua`
  - NUI Fokus/Visibility
  - Open/Close Workflow (ATM/Bank)
  - NUI Callbacks fuer `deposit`, `withdraw`, `transfer`
  - ox_target Integration fuer ATMs + Bank-Peds
  - Blips/Ped-Lifecycle
- `client/menus.lua`
  - ox_lib Context-Menues fuer Account-Verwaltung
  - Create/Rename/Delete Account
  - Member-Management (hinzufuegen/entfernen)

### 4) Server-Layer
- `server/framework.lua`
  - Framework-Adapterfunktionen (Player, Geld, Jobs/Gangs, Auth-Checks, Notifications)
  - Framework-spezifische Kompatibilitaets-Exports/Event-Bindings
- `server/main.lua`
  - In-Memory-Caches (`cachedAccounts`, `cachedPlayers`)
  - DB-Bootstrap + Laden aller Konten
  - Business-Logik fuer Deposit/Withdraw/Transfer
  - Transaktionshistorie (JSON arrays)
  - Shared-Account-Verwaltung (create, rename, auth-members)
  - Exports fuer externe Ressourcen
  - `/givecash` Command

### 5) NUI / Frontend
- Ausgeliefert wird nur Build-Output:
  - `web/public/build/bundle.js`
  - `web/public/build/bundle.css`
- `web/public/index.html` bindet Google Fonts + globale Styles + Bundle ein.
- `web/public/global.css` enthaelt globale CSS Variablen/Utility-Basics.
- Wenn UI angepasst wird:
  - Build-Artefakte konsistent halten.
  - Keine manuellen Edits in minifiziertem `bundle.js`, wenn Source verfuegbar ist (stattdessen aus Source neu bauen).
  - Falls Source nicht im Repo ist, Aenderungen an UI nur mit nachvollziehbarer Dokumentation.

### 6) Lokalisierung
- `locales/en.json` ist Referenzdatei.
- Alle Locale-Dateien sollen exakt dieselben Keys enthalten (aktuell konsistent).
- Neue Texte immer zuerst in `en.json`, dann in alle anderen Locales ergaenzen (mindestens fallback-konforme Platzhalter).
- Platzhalter (`%s`, `${renewed_banking}`) exakt beibehalten.

## Domänenmodell (fachliches Modell)
### Konto-Typen
- `personal` (Spielerbankkonto, aus Framework-Geldkonto `bank`)
- `org` (Job/Gang/Society-Konto aus `bank_accounts_new`)
- `shared` (benutzererstellte Sub-Accounts, ebenfalls in `bank_accounts_new`)

Hinweis: Shared-Accounts werden technisch ebenfalls als `org`-Typ an die UI geliefert, mit eigener `creator`/`auth` Logik.

### Kern-Entitaeten (in Cache/UI)
- Account (vereinheitlichtes Modell)
  - `id: string`
  - `type: string` (`personal` / lokalisiert `org`)
  - `name: string`
  - `frozen: boolean|number`
  - `amount: number`
  - `transactions: transaction[]`
  - `auth?: table<string, true>` (serverseitig fuer shared/org Accounts)
  - `creator?: string|null` (nur shared Accounts)
  - `cash?: number` (nur persoenliches UI-Konto)

- PlayerCache (`cachedPlayers[cid]`)
  - `isFrozen`
  - `transactions: transaction[]`
  - `accounts: string[]` (shared account IDs mit Zugriff)

- Transaction
  - `trans_id`
  - `title`
  - `amount`
  - `trans_type` (`deposit` | `withdraw`)
  - `receiver`
  - `message`
  - `issuer`
  - `time` (Unix Epoch)

### Autorisierung (Domain-Regeln)
- Personal-Konto: eigener Spieler.
- Job-Konto:
  - QB/QBX: Grade mit `bankAuth = true`
  - ESX: Boss-Grade
- Gang-Konto:
  - QB/QBX via `bankAuth`
  - ESX nicht genutzt
- Shared-Konto:
  - `creator` darf umbenennen, loeschen, Mitglieder verwalten
  - `auth` listet berechtigte CitizenIDs/Identifier

## Datenbankschema (SQL)
### `bank_accounts_new`
- `id` (PK): Konto-ID (Job/Gang/Shared)
- `amount`: Kontostand
- `transactions`: JSON Array (longtext)
- `auth`: JSON Array berechtigter IDs (longtext)
- `isFrozen`: Freeze-Flag
- `creator`: Ersteller-ID (nur relevant fuer Shared-Accounts)

### `player_transactions`
- `id` (PK): Spieler-Identifier/CitizenID
- `isFrozen`: Freeze-Flag (aktuell im Code kaum genutzt)
- `transactions`: JSON Array persoenlicher Transaktionen

## Laufzeit-Workflow (fachlicher Ablauf)
### Initialisierung
1. Resource startet, Tabellen werden sichergestellt.
2. Server laedt `bank_accounts_new` in `cachedAccounts`.
3. Fehlende Job/Gang-Konten werden aus Framework-Definitionen automatisch angelegt.
4. Beim Spieler-Load werden `player_transactions` + Shared-Account-Zugriffe in `cachedPlayers` aufgebaut.
5. Client initialisiert Peds, Targets und sendet Locale-Daten ans NUI.

### UI Oeffnen
1. Interaktion via ATM oder Bank-Ped (`ox_target`).
2. Progressbar/Animation.
3. Client ruft `renewed-banking:server:initalizeBanking` auf.
4. Server liefert aggregierte Kontoliste (personal + job/gang + shared).
5. NUI rendert Konten und Transaktionen.

### Buchungen
- `deposit`, `withdraw`, `transfer` laufen serverseitig ueber `lib.callback`.
- Validierung immer serverseitig (Amount >= 1, Konto vorhanden, Funds vorhanden, Ziel existent).
- Nach erfolgreicher Aktion:
  - Framework-Geldkonto und/oder cached org/shared Konto aktualisieren
  - Transaktionshistorien aktualisieren
  - DB persistieren
  - frische Bankdaten an UI zurueckgeben

## Codestyle (Ist + Soll fuer neue Aenderungen)
### Bestehender Stil (Ist)
- Lua mit gemischter Benennung:
  - `camelCase` bei vielen lokalen Funktionen/Variablen (`getBankData`, `cachedAccounts`)
  - `PascalCase` bei frameworknahen Hilfsfunktionen (`GetPlayerObject`, `AddMoney`)
  - Event/Callback-Namen mit `Renewed-Banking:*`
- Imperativer Stil mit fruehen Returns.
- Tabellen als zentrale Datenstruktur (statt Klassen).
- Serverseitiger Cache als Performance-Optimierung.

### Vorgaben fuer neue Aenderungen (Soll)
- Bestehende oeffentliche API-Namen unveraendert lassen.
- Innerhalb einer Datei konsistente Benennung verwenden:
  - lokale Helper: `camelCase`
  - exports/adapter-Funktionen: bestehendes Schema beibehalten (`GetX`, `AddX`)
- Funktionen klein halten (eine Verantwortung pro Funktion).
- Fruehe Returns bevorzugen, um tiefes Nesting zu vermeiden.
- Magische Strings in wiederverwendbare lokale Konstanten auslagern, wenn sie mehrfach auftreten.
- Kommentare nur dort, wo Domain-Regeln oder Framework-Unterschiede nicht selbsterklaerend sind.
- Input-Normalisierung clientseitig (UI-Komfort) und Validierung serverseitig (Sicherheit) getrennt behandeln.

## Verwendete Coding-Prinzipien (im aktuellen Code erkennbar)
- Adapter-/Abstraktionsprinzip fuer Frameworks:
  - QBCore/QBX/ESX Unterschiede sind in `server/framework.lua` und `client/framework.lua` gekapselt.
- Cache-First-Ansatz:
  - Konten und Spielertransaktionen werden im Speicher gehalten und DB-Zugriffe reduziert.
- Single Source of Truth pro Schicht:
  - Server-Caches sind die fachliche Wahrheit fuer org/shared Konten waehrend der Laufzeit.
- Separation of Concerns:
  - Client = Interaktion/NUI/Targets
  - Server = Validierung, Berechtigungen, Persistenz, Buchungslogik
- Rueckwaertskompatibilitaet:
  - `qb-management` / `esx_society` Kompatibilitaets-Exports
- Defensive Checks:
  - Amount-Pruefung, Account-Existenz, Zielspielerpruefung, Auth-Checks

## Zusaetzliche Best Practices (fuer neue Arbeit)
### Sicherheit / Missbrauchsschutz
- Niemals auf clientseitige Werte vertrauen (`amount`, `fromAccount`, `stateid`, `comment` immer serverseitig validieren).
- Bei neuen Server-Events immer:
  - Player laden/prüfen
  - Rechte pruefen
  - Typen pruefen (`type(...)`)
  - Bereichs-/Grenzwerte pruefen
- Bei kontoveraendernden Operationen negative oder NaN-Werte explizit ausschliessen.
- Exports mit Schreibrechten nur serverseitig exponieren und dokumentieren.

### Datenkonsistenz
- Cache und DB immer zusammen aktualisieren (Reihenfolge bewusst waehlen und dokumentieren).
- Bei Rename/Delete von Accounts alle Referenzen in `cachedPlayers` aktualisieren.
- JSON-Felder immer mit `json.encode/json.decode` konsistent behandeln.
- Schemaaenderungen versionieren und in `README` + SQL-Datei dokumentieren.

### Fehlerbehandlung / Logging
- Fehler fuer Betreiber nachvollziehbar loggen (Account-ID, Action, Source), aber keine sensiblen Daten uebermaessig dumpen.
- Nutzerfehler via `Notify`/NUI-Notification, Systemfehler via Server-Log.
- Bei neuen kritischen Init-Schritten `assert(...)` oder klare Abbruch-Logs verwenden.

### Performance
- Keine unnötigen DB-Queries in Hot Paths (UI callbacks / Transfers).
- Wiederholte Framework-Lookups vermeiden; Adapterfunktionen und Caches nutzen.
- Bei groesseren Listen/Transaktionen Pagination oder Limits mitdenken (UI/Export-Features).

### API-/Event-Design
- Neue NUI/Net Events nach Schema benennen:
  - `Renewed-Banking:client:*`
  - `Renewed-Banking:server:*`
- Event-Payloads als Tabellen mit stabilen Feldnamen statt positional args, ausser bei bestehenden APIs.
- Rueckgabestrukturen fuer UI/Exports dokumentieren (Feldnamen, Typen, optionale Felder).

### Lokalisierung
- Kein Hardcoding von UI-Texten in Client/Server, wenn bereits Locale-Key sinnvoll ist.
- Neue Meldungen zuerst in `en.json`, dann in andere Sprachen mit identischem Key.
- `%s`-Reihenfolge und Anzahl pro Sprache pruefen.

### Frontend/NUI
- Generierte Dateien (`web/public/build/*`) nicht "per Hand" patchen, wenn Source vorhanden ist.
- Bei UI-Aenderungen immer pruefen:
  - NUI Message Actions (`setVisible`, `setLoading`, `notify`, `updateLocale`) bleiben kompatibel
  - Callback-Namen (`deposit`, `withdraw`, `transfer`, `closeInterface`) bleiben stabil
- CSS-Variablen in `global.css` bevorzugen statt hart codierter Farbwerte in mehreren Stellen.

## Aenderungs-Workflow fuer Agenten
1. Vor Aenderungen betroffene Schicht bestimmen (Client / Server / Config / SQL / Locale / UI).
2. Bestehende Event-/Export-Namen auf Kompatibilitaetsrisiko pruefen.
3. Wenn Datenmodell betroffen ist:
   - Cache-Update
   - DB-Persistenz
   - UI-Rueckgabe
   - Locale-Meldungen
   gemeinsam betrachten.
4. Lokale Tests/Checks ausfuehren (mindestens Syntax/Smoke-Check; sofern Umgebung vorhanden).
5. In der Antwort kurz dokumentieren:
   - geaenderte Dateien
   - API-/Schema-Auswirkungen
   - notwendige Migration/Restart-Hinweise

## Bekannte Besonderheiten / Stolperfallen
- Schreibweise `initalizeBanking` ist historisch inkonsistent (nicht ohne Kompatibilitaetspruefung umbenennen).
- `frozen`/`isFrozen` ist teilweise vorbereitet, aber nicht durchgaengig als harte Business-Regel erzwungen.
- Frontend-Source ist im aktuellen Repo nicht enthalten; nur gebaute Assets liegen vor.
- `server/main.lua` erstellt Tabellen zusaetzlich zur SQL-Datei automatisch (doppelte Verantwortlichkeit beachten).

## Wenn du neue Features baust
- Bevorzuge Erweiterungen ueber bestehende Adapter/Exports statt framework-spezifische Direktlogik im Kern.
- Halte Personal-/Org-/Shared-Account-Handling konsistent (Transaktionsspiegelung, Titel, Receiver/Issuer).
- Dokumentiere neue Config-Optionen, Locale-Keys und Exports immer in `README.md`.

