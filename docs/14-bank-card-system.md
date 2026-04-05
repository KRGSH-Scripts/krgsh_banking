---
title: "Bankkarten-System"
description: "Physische Bankkarten als Inventory-Items: Ausstellen, PIN-Schutz, ATM-Kartenfluss, Inventory-Provider-Adapter und Sicherheitshinweise."
tags: ["fivem", "banking", "lua", "bank-cards", "inventory", "pin", "atm"]
order: 15
---

# Bankkarten-System

## 1. Überblick & Zweck

Das Bankkarten-System ermöglicht es Spielern, physische Bankkarten (`bank_card` Item) für ihre Personal- und Shared-Konten auszustellen. Die Karten existieren als echte Inventory-Items und sind optional mit einem PIN geschützt.

**Kernfunktionen:**
- Spieler lassen Karten an der Bank ausstellen (Gebühr konfigurierbar)
- Karten als physische Items im Spieler-Inventory (ox_inventory, qb-inventory oder jaksam_inventory)
- Optionaler PIN-Schutz pro Karte
- ATM-Modus (`atmCardsOnly = true`): ATMs zeigen ausschließlich Konten an, für die der Spieler eine physische Karte besitzt
- PIN-Sessions: Nach erfolgreicher PIN-Eingabe wird die Session temporär gecacht (kein erneuter PIN bei jedem ATM-Zugriff)

**Beteiligte Dateien:**
- `server/inventory_cards.lua` – Inventory-Adapter, Karten-CRUD, PIN-Logik
- `server/main.lua` – NUI-Callback-Handler (`listBankCards`, `issueBankCard`, `setBankCardPin`, `deleteBankCard`, `atmSelectCard`)
- `config.lua` – Karten-Konfiguration

---

## 2. Konfiguration

Alle Optionen befinden sich in `config.lua` unter der `Config`-Table:

```lua
Config = {
    -- Inventory-Provider: 'ox_inventory' | 'qb_inventory' | 'jaksam_inventory'
    inventoryProvider = 'ox_inventory',

    -- Optionaler Override des Ressourcennamens für qb_inventory
    -- (Standard: 'qb-inventory')
    inventoryResource = 'qb-inventory',

    -- Item-Name der Bankkarte im Inventory
    bankCardItem = 'bank_card',

    -- Ausstellungsgebühr in der Spielwährung
    bankCardFee = 500,

    -- Konto, von dem die Gebühr abgezogen wird: 'bank' | 'cash'
    bankCardFeeAccount = 'bank',

    -- Name des ausstellenden Instituts auf der Karte
    -- nil = Locale-Key 'bank_name' wird verwendet
    bankCardInstitution = nil,

    -- Dauer einer erfolgreichen PIN-Session in Sekunden (Standard: 600 = 10 Minuten)
    bankCardPinSessionSeconds = 600,

    -- Geheimer Schlüssel für PIN-Hashing
    -- WICHTIG: Auf Produktionsservern via Convar überschreiben!
    bankCardPinSecret = 'change_me',

    -- ATM zeigt nur Konten an, für die eine physische Karte vorhanden ist
    atmCardsOnly = true,

    -- Verhindert Account-Löschung wenn Guthaben > 0
    requireZeroBalanceToClose = true,
}
```

### Convar-Override

Der `bankCardPinSecret` sollte auf Produktionsservern **niemals** im Code gespeichert werden. Stattdessen via `server.cfg` setzen:

```
set krgsh_banking:card_pin_secret "mein_geheimer_schluessel_2025"
```

Die Resource liest beim Start: `GetConvar('krgsh_banking:card_pin_secret', Config.bankCardPinSecret)`.

---

## 3. Inventory-Provider-Adapter

Das System unterstützt drei Inventory-Ressourcen. Der Adapter abstrahiert alle inventarspezifischen API-Aufrufe hinter einheitlichen internen Funktionen.

### ox_inventory (Standard)

```lua
-- Suchen:   exports.ox_inventory:Search(src, 'items', itemName)
-- Hinzuf.:  exports.ox_inventory:AddItem(src, itemName, 1, metadata)
-- Metadata: exports.ox_inventory:SetMetadata(src, slot, metadata)
-- Entf.:    exports.ox_inventory:RemoveItem(src, itemName, 1, nil, slot)
```

Metadata-Format:
```lua
{
    accountId   = "char1:abc123",
    cardId      = "card_a1b2c3",
    institution = "FLEECA BANK",
    label       = "Girokonto",
    hasPin      = false,
    pinHash     = nil,    -- gehashter PIN nach setBankCardPin
}
```

### qb_inventory

```lua
-- Suchen:   PlayerData.items (iterieren, type == itemName)
-- Hinzuf.:  exports[inventoryResource]:AddItem(src, itemName, 1, slot, metadata)
--           Player.Functions.SetInventory(items)
-- Metadata: QBCore-spezifische Item-Info-Table
-- Entf.:    exports[inventoryResource]:RemoveItem(src, itemName, 1, slot)
```

### jaksam_inventory

```lua
-- Suchen:   exports['jaksam_inventory']:getItemsByName(src, itemName)
-- Hinzuf.:  exports['jaksam_inventory']:addItem(src, itemName, 1, metadata)
-- Metadata: exports['jaksam_inventory']:setItemMetadataInSlot(src, slot, metadata)
--           exports['jaksam_inventory']:updateItemMetadata(src, slot, patch)
-- Entf.:    exports['jaksam_inventory']:removeItem(src, slot, 1)
```

---

## 4. Öffentliche Serverfunktionen

Diese Lua-Funktionen sind global in `server/inventory_cards.lua` definiert und innerhalb der Resource verwendbar.

### `FindBankCardItems(src, itemName?)`

Gibt alle Bankkarten-Items des Spielers zurück.

```lua
---@param src    number           Spieler-Source
---@param itemName string|nil     Item-Name (default: Config.bankCardItem)
---@return table[]                Array von { metadata: table, slot: any, count: number }

local cards = FindBankCardItems(src)
-- cards = {
--   { metadata = { accountId = "char1:abc", cardId = "card_xyz", hasPin = true, ... }, slot = 3, count = 1 },
--   { metadata = { accountId = "police",    cardId = "card_aaa", hasPin = false, ... }, slot = 7, count = 1 },
-- }
```

### `AddBankCardItem(src, itemName?, metadata)`

Fügt eine neue Bankkarte zum Spieler-Inventory hinzu.

```lua
---@param src      number
---@param itemName string|nil
---@param metadata table        Karten-Metadaten (accountId, cardId, institution, label, hasPin)
---@return boolean ok
---@return string|nil err

local ok, err = AddBankCardItem(src, nil, {
    accountId   = "char1:abc123",
    cardId      = "card_" .. math.random(100000, 999999),
    institution = "FLEECA BANK",
    label       = "Mein Konto",
    hasPin      = false,
})
if not ok then
    print("Fehler beim Ausstellen:", err)
end
```

### `PatchBankCardItemMetadata(src, itemName?, slot, patch)`

Aktualisiert Felder in den Metadaten einer bestehenden Karte (z.B. nach PIN-Setzung).

```lua
---@param src      number
---@param itemName string|nil
---@param slot     any           Slot aus FindBankCardItems
---@param patch    table         Zu ändernde Felder
---@return boolean ok

local ok = PatchBankCardItemMetadata(src, nil, slot, {
    hasPin  = true,
    pinHash = hashBankPin(accountId, cardId, "1234"),
})
```

### `RemoveBankCardFromSlot(src, itemName?, slot, count?)`

Entfernt eine Bankkarte aus einem bestimmten Inventory-Slot.

```lua
---@param src      number
---@param itemName string|nil
---@param slot     any
---@param count    number|nil    (default: 1)
---@return boolean ok

local ok = RemoveBankCardFromSlot(src, nil, slot)
```

---

## 5. ATM-Kartenfluss (Schritt-für-Schritt)

Der ATM-Kartenfluss greift wenn `Config.atmCardsOnly = true` aktiv ist.

```
Spieler nähert sich ATM
        │
        ▼
Client: ox_target Callback → lib.callback 'krgsh_banking:server:initalizeBanking'
        │
        ▼
Server: FindBankCardItems(src)
  → Karten im Inventory suchen
  → atmCards = [{ accountId, cardId, accountName, label, needsPin }] aufbauen
  → setVisible senden (atm=true, atmCards=[...], accounts=[])
        │
        ▼
UI: Route /atm → AtmCardPicker wird angezeigt
  → Spieler wählt Karte
        │
        ├─── needsPin = false ──────────────────────────────────────┐
        │                                                            │
        ▼                                                            │
UI: AtmPinEntry wird angezeigt                                       │
  → Spieler gibt PIN ein                                             │
        │                                                            │
        ▼                                                            ▼
NUI Callback: postNui('atmSelectCard', {          NUI Callback: postNui('atmSelectCard', {
  accountId, cardId, pin: "1234"                    accountId, cardId
})                                                })
        │                                                            │
        └──────────────────────┬─────────────────────────────────────┘
                               ▼
Server: verifyBankPin(accountId, cardId, pin, pinHash)
  → ok: PIN-Session erstellen (expiresAt = now + Config.bankCardPinSessionSeconds)
  → Kontodaten laden und zurückgeben
  → { ok: true, accounts: [...] }

  → fail: { ok: false, needsPin: true }
        │
        ▼
UI: ATM-Hauptansicht (/atm) mit Kontostand, QuickActions, AtmKeypad
```

### ATM-Card-Session

Nach erfolgreicher PIN-Eingabe wird eine In-Memory-Session auf dem Server gespeichert:

```lua
cardSessions[src] = {
    [accountId] = {
        cardId    = "card_xyz",
        expiresAt = os.time() + Config.bankCardPinSessionSeconds
    }
}
```

Nachfolgende ATM-Aktionen (deposit/withdraw) prüfen via `isCardSessionValid(src, accountId, cardId)`, ob die Session noch gültig ist. So muss der Spieler den PIN nicht bei jeder Transaktion erneut eingeben.

---

## 6. PIN-System

### Hashing

```lua
-- Interner 3-Runden DJB2-Variante mit Secret
-- Gibt einen Hex-String zurück (kein Klartext-PIN in DB)
hashBankPin(accountId, cardId, pin) → string
```

Beispiel:
```lua
local hash = hashBankPin("char1:abc123", "card_xyz", "1234")
-- → "a3f9b2..." (Hex)
```

Der Hash wird in den Karten-Metadaten des Inventory-Items gespeichert (`metadata.pinHash`).

### Verifikation

```lua
-- pinHash = nil oder "" → kein PIN gesetzt → gibt immer true zurück
verifyBankPin(accountId, cardId, pin, pinHash) → boolean
```

### Session-Prüfung

```lua
-- Prüft ob eine aktive und nicht-abgelaufene PIN-Session existiert
isCardSessionValid(src, accountId, cardId) → boolean
```

Sessions werden bei Spieler-Disconnect automatisch gelöscht.

---

## 7. NUI-Integration (bank-cards Route)

Die Route `/bank-cards` in der React-App stellt folgende NUI-Callbacks bereit:

### `listBankCards`

Gibt alle Konten mit ihrem aktuellen Karten-Status zurück.

```ts
const result = await postNui<{ personal: CardEntry[], shared: CardEntry[] }>('listBankCards', {});
```

**Antwort-Struktur:**
```json
{
  "personal": [
    {
      "accountId": "char1:abc123",
      "accountName": "Girokonto",
      "hasCard": true,
      "cardId": "card_xyz",
      "needsPin": true
    }
  ],
  "shared": [
    {
      "accountId": "shared_abc",
      "accountName": "Familienkasse",
      "hasCard": false,
      "cardId": null,
      "needsPin": false
    }
  ]
}
```

### `issueBankCard`

Stellt eine neue Karte für ein Konto aus. Zieht `bankCardFee` vom konfigurierten Konto ab.

```ts
const accounts = await postNui<Account[]>('issueBankCard', {
  accountId: 'char1:abc123',
});
```

Gibt bei Erfolg die aktualisierte Account-Liste zurück, `false` bei Fehler.

**Mögliche Fehler:**
- Karte bereits vorhanden
- Nicht genügend Guthaben für die Ausstellungsgebühr
- Konto nicht gefunden / kein Zugriff

### `setBankCardPin`

Setzt oder ändert den PIN einer Karte.

```ts
await postNui('setBankCardPin', {
  accountId: 'char1:abc123',
  cardId:    'card_xyz',
  pin:       '1234',       // 4-stellig, nur Ziffern
});
```

Der PIN wird serverseitig mit `hashBankPin` gehasht. Der Klartext-PIN wird nie gespeichert.

### `deleteBankCard`

Löscht eine Karte aus dem Inventory und entfernt sie aus der Account-Karten-Liste in der DB.

```ts
await postNui('deleteBankCard', {
  accountId: 'char1:abc123',
  cardId:    'card_xyz',
});
```

---

## 8. Sicherheitshinweise

| Aspekt | Maßnahme |
|---|---|
| PIN-Speicherung | Nur gehashter PIN in Inventory-Metadaten; kein Klartext |
| PIN-Secret | **Convar** `krgsh_banking:card_pin_secret` auf Produktionsservern setzen |
| ATM-Absicherung | Mit `atmCardsOnly = true` sind ATMs nur für Karteninhaber nutzbar |
| Session-Expiry | PIN-Sessions laufen nach `bankCardPinSessionSeconds` ab |
| Server-Validierung | Alle Karten-Operationen werden serverseitig validiert; keine Clientseitige Autorität |
| Konto-Löschen | `requireZeroBalanceToClose = true`: verhindert Löschung bei Guthaben > 0 |
| Rate-Limiting | Inventory-Mutationen nur über verifizierte NUI-Callbacks; kein direkter Client-Zugriff |

> **Wichtig:** Der Standard-`bankCardPinSecret = 'change_me'` ist **kein** sicherer Produktionswert. Serverbetreiber **müssen** diesen via Convar überschreiben.

---

## 9. Beispiel: Karte aus externem Script ausstellen

Externe Resources können Bankkarten programmatisch ausstellen, indem sie auf dem Server `exports['krgsh_banking']` nutzen oder direkt die internen Funktionen via `exports` aufrufen:

```lua
-- In einer anderen Resource (Server-Side):
-- Voraussetzung: krgsh_banking läuft und der Spieler (src) ist online

local src        = GetPlayerIdentifierByType(source, 'license')  -- oder CitizenID
local accountId  = "char1:abc123"  -- Personal-Konto-ID des Spielers
local cardId     = "card_" .. tostring(math.random(100000, 999999))
local institution = "CUSTOM BANK"
local label      = "VIP-Karte"

-- Karte hinzufügen (globale Funktion aus inventory_cards.lua, Resource-intern)
-- Für externe Resources: eigenes ox_inventory AddItem aufrufen mit korrekten Metadaten
exports.ox_inventory:AddItem(src, 'bank_card', 1, {
    accountId   = accountId,
    cardId      = cardId,
    institution = institution,
    label       = label,
    hasPin      = false,
})

-- Dann den Account in bank_accounts_new / cachedAccounts um die cardId ergänzen
-- → via Export (sofern vorhanden) oder direkt über oxmysql
```

> **Hinweis:** Für vollständige externe Integration wird empfohlen, den Export `AddBankCardForAccount(src, accountId)` zu verwenden, sobald dieser als öffentlicher Export verfügbar ist. Alternativ kann die Karte manuell mit korrekten Metadaten hinzugefügt und die DB entsprechend aktualisiert werden.
