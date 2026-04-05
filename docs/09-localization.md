---
title: "Lokalisierung"
description: "22-sprachiges Lokalisierungssystem auf Basis von ox_lib: Locale-Dateien, Key-Struktur, NUI-Übertragung und Hinzufügen neuer Sprachen."
tags: ["fivem", "banking", "localization", "i18n"]
order: 9
---

# Lokalisierungssystem

## Überblick

Die Resource unterstützt **22 Sprachen** über JSON-Locale-Dateien. Das System basiert auf `ox_lib`'s eingebautem Locale-System (`lib.locale()` / `lib.getLocales()`).

---

## Unterstützte Sprachen

| Datei | Sprache |
|---|---|
| `en.json` | Englisch (Referenz) |
| `de.json` | Deutsch |
| `fr.json` | Französisch |
| `es.json` | Spanisch |
| `pt.json` | Portugiesisch |
| `ru.json` | Russisch |
| `pl.json` | Polnisch |
| `cs.json` | Tschechisch |
| `da.json` | Dänisch |
| `el.json` | Griechisch |
| `et.json` | Estnisch |
| `fi.json` | Finnisch |
| `hr.json` | Kroatisch |
| `hu.json` | Ungarisch |
| `id.json` | Indonesisch |
| `it.json` | Italienisch |
| `lt.json` | Litauisch |
| `nl.json` | Niederländisch |
| `sl.json` | Slowenisch |
| `sr.json` | Serbisch |
| `sv.json` | Schwedisch |
| `tr.json` | Türkisch |

---

## Server-Initialisierung

`config.lua` Zeile 1:
```lua
lib.locale()
```

Dies aktiviert das ox_lib Locale-System. Die aktive Sprache wird über `setr ox:locale <code>` in der `server.cfg` konfiguriert. Standard ist Englisch.

---

## Locale-Nutzung im Lua-Code

```lua
locale("key")                -- einfacher Schlüssel
locale("key_with_param", value)  -- %s-Substitution
```

Beispiele:
```lua
locale("bank_name")                           -- "Los Santos Banking"
locale("invalid_amount", "deposit")           -- "Invalid amount to deposit"
locale("comp_transaction", name, "deposited", 500)  -- "Max Mustermann has deposited $500"
```

---

## Locale-Keys Referenz (`en.json`)

### Zeit-Anzeige
| Key | Wert |
|---|---|
| `weeks` | `"%s weeks ago"` |
| `aweek` | `"A week ago"` |
| `days` | `"%s days ago"` |
| `aday` | `"A day ago"` |
| `hours` | `"%s hours ago"` |
| `ahour` | `"A hour ago"` |
| `mins` | `"%s minutes ago"` |
| `amin` | `"A minute ago"` |
| `secs` | `"A few seconds ago"` |

### Server-Fehlermeldungen
| Key | Wert |
|---|---|
| `invalid_account` | `"${krgsh_banking} Account not found (%s)"` |
| `broke_account` | `"${krgsh_banking} Account(%s) is too broke with balance of $%s"` |
| `illegal_action` | `"${krgsh_banking} %s has attempted..."` |
| `existing_account` | `"${krgsh_banking} Account %s already exsist"` |
| `invalid_amount` | `"Invalid amount to %s"` |
| `not_enough_money` | `"Account does not have enough funds!"` |
| `comp_transaction` | `"%s has %s $%s"` |
| `fail_transfer` | `"Failed to transfer to unknown account!"` |
| `account_taken` | `"Account ID is already in use"` |
| `loading_failed` | `"Failed to load Banking Data!"` |
| `dead` | `"Action failed, you're dead"` |
| `too_far_away` | `"Action failed, too far away"` |

### handleTransaction Fehler
| Key | Beschreibung |
|---|---|
| `err_trans_account` | Ungültige Account-ID |
| `err_trans_title` | Ungültiger Titel |
| `err_trans_amount` | Ungültiger Betrag |
| `err_trans_message` | Ungültige Nachricht |
| `err_trans_issuer` | Ungültiger Issuer |
| `err_trans_receiver` | Ungültiger Receiver |
| `err_trans_type` | Ungültiger Trans-Typ |
| `err_trans_transID` | Ungültige Trans-ID |

### UI-Texte
| Key | Wert |
|---|---|
| `bank_name` | `"Los Santos Banking"` |
| `org` | `"Organization"` |
| `personal` | `"Personal"` |
| `deposit_but` | `"Deposit"` |
| `withdraw_but` | `"Withdraw"` |
| `transfer_but` | `"Transfer"` |
| `frozen` | `"Account Status: Frozen"` |
| `balance` | `"Available Balance"` |
| `cash` | `"Cash: $"` |
| `transactions` | `"Transactions"` |
| `accounts` | `"Accounts"` |
| `transfer` | `"Business or Citizen ID"` |
| `select_account` | `"Select any Account"` |
| `trans_search` | `"Transaction Search (Message, TransID, Receiver)..."` |
| `export_data` | `"Export Transaction Data"` |
| `account_search` | `"Account Search..."` |

### Menü-Texte
| Key | Wert |
|---|---|
| `create_account` | `"Create New Account"` |
| `manage_account` | `"Manage Existing Accounts"` |
| `manage_members` | `"Manage Account Members"` |
| `edit_acc_name` | `"Change Account Name"` |
| `delete_account` | `"Delete Account"` |
| `add_member` | `"Add Citizen To Account"` |
| `remove_member` | `"Are you sure you want to remove Citizen?"` |
| `view_bank` | `"View Bank Account"` |
| `manage_bank` | `"Manage Bank Account"` |

---

## Locale-Übertragung an die NUI

```lua
local locales = lib.getLocales()
SendNUIMessage({
    action       = 'updateLocale',
    translations = locales,
    currency     = Config.currency
})
```

`lib.getLocales()` gibt alle Keys der aktiven Sprache als flache Map zurück.

### NUI-seitige Nutzung

```js
function t(key, fallback) {
    const value = state.locale && state.locale[key];
    return typeof value === 'string' && value.length > 0 
        ? value 
        : (fallback || FALLBACK_STRINGS[key] || key);
}
```

Dreistufiger Fallback: Server-Locale → `FALLBACK_STRINGS` (deutsche Defaults) → Key

---

## `${krgsh_banking}` Platzhalter

Manche Fehlermeldungen enthalten `${krgsh_banking}`, was zu `"^6[^4krgsh_banking^6]^0"` aufgelöst wird. Dies ist ein FiveM-Konsolenfarb-Code für Server-Logs.

```json
"krgsh_banking": "^6[^4krgsh_banking^6]^0"
```

---

## Neue Sprache hinzufügen

1. `locales/en.json` kopieren nach `locales/xx.json`
2. Alle Werte übersetzen
3. `%s`-Platzhalter-Anzahl und -Reihenfolge beibehalten
4. `${krgsh_banking}` unveränderlich lassen
5. In `fxmanifest.lua` wird `locales/*.json` bereits via `files` eingeschlossen – keine weitere Anpassung nötig

## Neuen Locale-Key hinzufügen

1. Key in `locales/en.json` einfügen
2. Key in **allen** 22 Sprachen einfügen (zumindest englischen Fallback-Wert)
3. Im Lua-Code: `locale("neuer_key")`
4. In der NUI: `t('neuer_key', 'Fallback-Text')`
