lib.locale()
Config = {
    -- Framework automatically detected
    -- QB, QBX, and ESX preconfigured edit the framework.lua to add functionality to other frameworks
    krgshMultiJob = false, -- QBCORE ONLY! Multi-Job via qb-phone (https://github.com/Renewed-Scripts/qb-phone)
    -- Resources allowed to call `create_subscription` export (empty = only this resource)
    paymentInstructionsTrustedResources = {},
    progressbar = 'circle', -- circle or rectangle (Anything other than circle will default to rectangle)
    currency = 'USD', -- USD, EUR, GBP ect.....
    --- Bank cards (personal + shared accounts): item-based access + optional PIN
    inventoryProvider = 'jaksam_inventory', -- 'ox_inventory' | 'qb_inventory' | 'jaksam_inventory'
    --- qb-inventory resource folder is often `qb-inventory` (hyphen); override if yours differs
    ---inventoryResource = 'qb-inventory',
    bankCardItem = 'bank_card',
    bankCardFee = 500,
    bankCardFeeAccount = 'bank', -- 'bank' | 'cash'
    --- Display string stored on the card item metadata (`bank` field) for inventory UIs
    bankCardInstitution = nil, -- nil = use locale key bank_name at issue time
    bankCardPinSessionSeconds = 600,
    --- Used with PIN hashing; set convar `krgsh_banking:card_pin_secret` on production servers
    bankCardPinSecret = 'change_me',
    --- When true, ATMs only list accounts reachable via a physical bank_card item (personal + shared; no job/gang at ATM).
    atmCardsOnly = true,
    requireZeroBalanceToClose = true,
    -- UI theming / bank branding
    -- `theme` is a key from Config.uiThemes and can be overridden per event call / per ped.
    -- Example:
    -- TriggerEvent('krgsh_banking:client:openBankUI', { atm = false, theme = 'FLEECA', institution = 'FLEECA Bank', location = 'Downtown' })
    uiDefaults = {
        bank = {
            theme = 'DEFAULT',
            institution = 'Los Santos Banking',
            subtitle = 'Where your money makes us rich',
            location = 'Los Santos',
            contextLabel = 'Bank'
        },
        atm = {
            theme = 'DEFAULT',
            institution = 'Los Santos Banking',
            subtitle = 'ATM Self-Service',
            location = 'Los Santos',
            contextLabel = 'Geldautomat'
        }
    },
    -- Themes: black background, gray foreground, highlight = accent (pink / green / red)
    uiThemes = {
        DEFAULT = {
            logo = '', -- optional: path under web/public e.g. 'img/banks/logo.png'
            colors = {
                bg = '#050505',
                bg2 = '#0c0c0c',
                surface = 'rgba(255, 255, 255, 0.035)',
                surface2 = 'rgba(255, 255, 255, 0.02)',
                card = 'rgba(14, 14, 14, 0.94)',
                border = 'rgba(255, 255, 255, 0.09)',
                text = '#e5e7eb',
                textMuted = '#9ca3af',
                textSoft = '#6b7280',
                accent = '#f472b6',
                accent2 = '#db2777',
                accentContrast = '#ffffff',
                glow = 'rgba(244, 114, 182, 0.32)',
                danger = '#fb7185',
                warning = '#fbbf24',
                flowRingOut = 'rgba(251, 113, 133, 0.28)'
            }
        },
        FLEECA = {
            logo = 'img/banks/fleeca-logo.png', -- replace with your real PNG if desired
            colors = {
                bg = '#050505',
                bg2 = '#0c0c0c',
                surface = 'rgba(255, 255, 255, 0.035)',
                surface2 = 'rgba(255, 255, 255, 0.02)',
                card = 'rgba(14, 14, 14, 0.94)',
                border = 'rgba(255, 255, 255, 0.09)',
                text = '#e5e7eb',
                textMuted = '#9ca3af',
                textSoft = '#6b7280',
                accent = '#4ade80',
                accent2 = '#16a34a',
                accentContrast = '#f0fdf4',
                glow = 'rgba(74, 222, 128, 0.30)',
                danger = '#fb7185',
                warning = '#fbbf24',
                flowRingOut = 'rgba(251, 113, 133, 0.28)'
            }
        },
        MAZE_BANK = {
            logo = 'img/banks/maze-bank-logo.png', -- replace with your MAZE BANK PNG
            colors = {
                bg = '#050505',
                bg2 = '#0c0c0c',
                surface = 'rgba(255, 255, 255, 0.035)',
                surface2 = 'rgba(255, 255, 255, 0.02)',
                card = 'rgba(14, 14, 14, 0.94)',
                border = 'rgba(255, 255, 255, 0.09)',
                text = '#e5e7eb',
                textMuted = '#9ca3af',
                textSoft = '#6b7280',
                accent = '#f87171',
                accent2 = '#dc2626',
                accentContrast = '#ffffff',
                glow = 'rgba(248, 113, 113, 0.30)',
                danger = '#fb7185',
                warning = '#fbbf24',
                flowRingOut = 'rgba(220, 38, 38, 0.32)'
            }
        }
    },
    atms = {
        -- Backwards compatible: plain model hashes still work
        "prop_atm_01",
        -- Optional per-ATM model branding via `BankConfig` / `bankConfig`
        -- ATM `location` is resolved automatically from the player's current street on open.
        -- { model = `prop_fleeca_atm`, BankConfig = { theme = 'FLEECA', institution = 'FLEECA Bank', contextLabel = 'Geldautomat' } },
        "prop_atm_02",
        "prop_atm_03",
        { model = "prop_fleeca_atm", BankConfig = { theme = 'FLEECA', institution = 'FLEECA Bank', contextLabel = 'Geldautomat' } },
    },
    peds = {
        [1] = { -- Pacific Standard
            model = 'u_m_m_bankman',
            coords = vector4(241.44, 227.19, 106.29, 170.43),
            createAccounts = true,
            -- Optional per-ped branding (used when opening the Bank UI from this NPC)
            -- BankConfig = { theme = 'MAZE_BANK', institution = 'MAZE BANK', subtitle = 'Executive Business Banking', location = 'Pillbox Hill' }
        },
        [2] = {
            model = 'ig_barry',
            coords = vector4(313.84, -280.58, 54.16, 338.31)
        },
        [3] = {
            model = 'ig_barry',
            createAccounts = true,
            coords = vector4(149.46, -1042.09, 29.37, 335.43),
            BankConfig = { theme = 'FLEECA', institution = 'FLEECA BANK', subtitle = 'Privat und Geschäftskunden Bank', location = 'Strawberry Avenue' }
        },
        [4] = {
            model = 'ig_barry',
            coords = vector4(-351.23, -51.28, 49.04, 341.73)
        },
        [5] = {
            model = 'ig_barry',
            coords = vector4(-1211.9, -331.9, 37.78, 20.07)
        },
        [6] = {
            model = 'ig_barry',
            coords = vector4(-2961.14, 483.09, 15.7, 83.84)
        },
        [7] = {
            model = 'ig_barry',
            coords = vector4(1174.8, 2708.2, 38.09, 178.52)
        },
        [8] = { -- paleto
            model = 'u_m_m_bankman',
            coords = vector4(-112.22, 6471.01, 31.63, 134.18),
            createAccounts = true
        }
    }
}
