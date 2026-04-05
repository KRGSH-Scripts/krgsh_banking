# Konfigurationsreferenz (`config.lua`)

## Überblick

Die `config.lua` wird als `shared_script` geladen und ist sowohl auf Client als auch Server verfügbar. Alle Optionen sind in der `Config`-Table zusammengefasst.

---

## Allgemeine Einstellungen

```lua
lib.locale()  -- ox_lib Locale-System initialisieren (muss am Anfang stehen)

Config = {
    renewedMultiJob = false,
    progressbar     = 'circle',
    currency        = 'USD',
    ...
}
```

| Option | Typ | Standard | Beschreibung |
|---|---|---|---|
| `renewedMultiJob` | boolean | `false` | **Nur QBCore.** Aktiviert Multi-Job-Support via `qb-phone`. Alle Jobs des Spielers werden für Bankzugriff geprüft. |
| `progressbar` | string | `'circle'` | `'circle'` → `lib.progressCircle`, alles andere → `lib.progressBar` |
| `currency` | string | `'USD'` | ISO 4217 Währungscode. Wird an die NUI übergeben und für `Intl.NumberFormat` genutzt. Beispiele: `'EUR'`, `'GBP'`, `'BRL'` |

---

## UI-Defaults (`Config.uiDefaults`)

Standard-Branding für Bank und ATM:

```lua
uiDefaults = {
    bank = {
        theme       = 'DEFAULT',
        institution = 'Los Santos Banking',
        subtitle    = 'Online Banking',
        location    = 'Los Santos',
        contextLabel = 'Bank'
    },
    atm = {
        theme       = 'DEFAULT',
        institution = 'Los Santos Banking',
        subtitle    = 'ATM Self-Service',
        location    = 'Los Santos',
        contextLabel = 'Geldautomat'
    }
}
```

Diese Werte werden verwendet, wenn kein spezifisches Branding an ATM oder Ped konfiguriert ist.

---

## UI-Themes (`Config.uiThemes`)

Farbschema-Definitionen. Jeder Theme-Key referenziert ein Farb-Objekt:

```lua
uiThemes = {
    DEFAULT = {
        logo   = '',  -- optionaler Pfad: 'img/banks/logo.png'
        colors = {
            bg              = '#050505',
            bg2             = '#0c0c0c',
            surface         = 'rgba(255, 255, 255, 0.035)',
            surface2        = 'rgba(255, 255, 255, 0.02)',
            card            = 'rgba(14, 14, 14, 0.94)',
            border          = 'rgba(255, 255, 255, 0.09)',
            text            = '#e5e7eb',
            textMuted       = '#9ca3af',
            textSoft        = '#6b7280',
            accent          = '#f472b6',    -- Eingangsfarbe / Akzent
            accent2         = '#db2777',
            accentContrast  = '#ffffff',
            glow            = 'rgba(244, 114, 182, 0.32)',
            danger          = '#fb7185',    -- Ausgangsfarbe / Fehler
            warning         = '#fbbf24',
            flowRingOut     = 'rgba(251, 113, 133, 0.28)'
        }
    },
    FLEECA = { ... },     -- Grünes Farbschema
    MAZE_BANK = { ... }   -- Rotes Farbschema
}
```

### Vordefinierte Themes

| Theme | Akzentfarbe | Beschreibung |
|---|---|---|
| `DEFAULT` | Pink (`#f472b6`) | Standard-Theme |
| `FLEECA` | Grün (`#4ade80`) | Fleeca Bank Branding |
| `MAZE_BANK` | Rot (`#f87171`) | Maze Bank Branding |

### Eigenes Theme hinzufügen

```lua
Config.uiThemes['MY_BANK'] = {
    logo = 'img/banks/my-bank-logo.png',
    colors = {
        bg = '#010a0f',
        accent = '#38bdf8',
        -- ... alle anderen Farb-Keys
    }
}
```

---

## ATM-Konfiguration (`Config.atms`)

```lua
atms = {
    `prop_atm_01`,        -- einfacher Model-Hash (rückwärtskompatibel)
    `prop_atm_02`,
    `prop_atm_03`,
    `prop_fleeca_atm`,
    -- Erweiterte Form mit Branding:
    -- { model = `prop_fleeca_atm`, BankConfig = { theme = 'FLEECA', institution = 'FLEECA Bank' } }
}
```

| Format | Beschreibung |
|---|---|
| `model_hash` | Einfacher Hash – ATM mit Default-Theme |
| `{ model, BankConfig }` | Hash + Branding-Override |

`BankConfig` kann enthalten: `theme`, `institution`, `subtitle`, `contextLabel`, `colors`, `logo`

**Interaction-Radius:** 2.5 Meter (fest in `canInteract`)

---

## Ped-Konfiguration (`Config.peds`)

```lua
peds = {
    [1] = {
        model          = 'u_m_m_bankman',
        coords         = vector4(x, y, z, heading),
        createAccounts = true,   -- Zeigt "Konto verwalten" Option
        -- optional:
        -- BankConfig = { theme = 'MAZE_BANK', institution = 'MAZE BANK', ... }
    },
    ...
}
```

| Feld | Typ | Pflicht | Beschreibung |
|---|---|---|---|
| `model` | string | ✓ | Ped-Model-Name |
| `coords` | vector4 | ✓ | Position (x, y, z) + Heading (w) |
| `createAccounts` | boolean | ✗ | Aktiviert "Konto verwalten"-Option am Ped |
| `BankConfig` | table | ✗ | Optionales Theme-Branding |

**Spawn-Radius:** 300 Meter (lib.points distance)  
**Interaction-Radius:** 4.5 Meter (canInteract)

---

## Per-Ped/ATM Branding (BankConfig)

Über `BankConfig` (oder `bankConfig`) kann jedes ATM und jeder Ped individuelles Branding erhalten:

```lua
BankConfig = {
    theme        = 'FLEECA',           -- Theme-Key aus Config.uiThemes
    institution  = 'FLEECA Bank',      -- Anzeige-Name in der UI
    subtitle     = 'Premium Banking',  -- Untertitel
    location     = 'Vinewood Hills',   -- Standort (ATM: auto-detect)
    contextLabel = 'Geldautomat',      -- ox_target Label
    logo         = 'img/banks/fleeca-logo.png',  -- Logo-Pfad
    colors       = { ... }             -- Farb-Overrides (merge mit Theme)
}
```

---

## Dynamisches Branding per Event

Bank-UI kann auch über einen Client-Event mit Branding geöffnet werden:

```lua
TriggerEvent('krgsh_banking:client:openBankUI', {
    atm         = false,
    theme       = 'FLEECA',
    institution = 'FLEECA Bank',
    subtitle    = 'Executive Banking',
    location    = 'Vinewood'
})
```

---

## Vordefinierte Bank-Standorte (Config.peds)

| Index | Modell | Koordinaten | Notiz |
|---|---|---|---|
| 1 | `u_m_m_bankman` | Innenstadt | Pacific Standard, `createAccounts = true` |
| 2 | `ig_barry` | Legion Square | |
| 3 | `ig_barry` | LSPD Station | |
| 4 | `ig_barry` | Rockford Hills | |
| 5 | `ig_barry` | Banham Canyon | |
| 6 | `ig_barry` | Chumash | |
| 7 | `ig_barry` | Sandy Shores | |
| 8 | `u_m_m_bankman` | Paleto Bay | `createAccounts = true` |
