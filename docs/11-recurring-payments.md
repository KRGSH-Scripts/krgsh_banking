# Geplante Zahlungen (Dauerauftrag, Lastschrift, Raten, Subscriptions)

## Überblick

Die Tabelle `bank_payment_instructions` speichert alle Aufträge. Ein Server-Worker (ca. alle 60 Sekunden) führt fällige Einträge aus und nutzt dieselbe Buchungslogik wie normale Überweisungen (`executeAccountTransfer` in `server/main.lua`).

- **Dauerauftrag (`standing_order`)**: Anlage in der Bank-NUI (nicht am Geldautomat). Status: aktiv, pausiert, gekündigt.
- **Lastschrift (`direct_debit`)**: Anlage per Export; Schuldner muss in der UI bestätigen. `interval_seconds = 0` = nur manuelle Abbuchung per `trigger_direct_debit`.
- **Ratenzahlung (`installment`)**: wie Lastschrift mit Bestätigung; `metadata.remaining_principal` wird pro Lauf reduziert, letzte Rate = `min(Rate, Rest)`.
- **Subscription (`subscription`)**: nur per Export; Nutzer kann pausieren, kündigen; **Aussetzen (System)** setzt `metadata.system_suspended` (nur vertrauenswürdige Resource).

## SQL

Die Tabelle wird beim Resource-Start mit angelegt (siehe `server/main.lua`, `createTables`). Optional: [bank_payment_instructions.sql](../bank_payment_instructions.sql).

## Konfiguration

In `config.lua`:

- `paymentInstructionsTrustedResources` – Liste von Resource-Namen, die `create_subscription` und `suspend_subscription_system` aufrufen dürfen. Leer = nur die Banking-Resource selbst.

## NUI / Client

- Route `/schedules` (Tab „Zahlungspläne“ in Übersicht und Buchungen, nur wenn nicht ATM).
- NUI-Callbacks: `listPaymentInstructions`, `createStandingOrder`, `updatePaymentInstruction`, `respondMandate` (Payload enthält `atm`, damit der Server ATM blocken kann).
- Event `krgsh_banking:client:pendingMandate` – Hinweis, wenn ein Mandat auf Bestätigung wartet.

## Server-Exports

Siehe [10-exports-api.md](10-exports-api.md) (Abschnitt „Payment instructions“). Ressourcenname im Export immer den **tatsächlichen Ordnernamen** der Resource verwenden.

## Randbedingungen

- **Persönliches Konto offline**: Geplante Abbuchung schlägt fehl; `next_run_at` wird um ca. 5 Minuten verschoben (Retry).
- **Empfänger persönlich offline**: Abbuchung schlägt fehl; Retry wie oben.
- **Org-/Shared-Konten**: Abbuchung ohne Online-Status des Schuldners möglich (Cache/DB).
