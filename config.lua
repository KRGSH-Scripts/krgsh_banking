lib.locale()
Config = {
    -- Framework automatically detected
    -- QB, QBX, and ESX preconfigured edit the framework.lua to add functionality to other frameworks
    renewedMultiJob = false, -- QBCORE ONLY! https://github.com/Renewed-Scripts/qb-phone  
    progressbar = 'circle', -- circle or rectangle (Anything other than circle will default to rectangle)
    currency = 'USD', -- USD, EUR, GBP ect.....
    -- UI theming / bank branding
    -- `theme` is a key from Config.uiThemes and can be overridden per event call / per ped.
    -- Example:
    -- TriggerEvent('Renewed-Banking:client:openBankUI', { atm = false, theme = 'FLEECA', institution = 'FLEECA Bank', location = 'Downtown' })
    uiDefaults = {
        bank = {
            theme = 'FLEECA',
            institution = 'FLEECA Bank',
            subtitle = 'Modern Homebanking',
            location = 'Los Santos',
            contextLabel = 'Bank'
        },
        atm = {
            theme = 'FLEECA',
            institution = 'Northern Pension Bank',
            subtitle = 'ATM Self-Service',
            location = 'Los Santos',
            contextLabel = 'Geldautomat'
        }
    },
    -- Add more themes here (different logo PNGs + base colors per bank)
    uiThemes = {
        FLEECA = {
            logo = 'img/banks/fleeca-logo.png', -- replace with your real PNG if desired
            colors = {
                bg = '#08110b',
                bg2 = '#101913',
                surface = 'rgba(14, 24, 16, 0.88)',
                surface2 = 'rgba(11, 18, 12, 0.94)',
                card = 'rgba(18, 30, 21, 0.92)',
                border = 'rgba(255, 255, 255, 0.08)',
                text = '#eefaf0',
                textMuted = '#b2cbb6',
                textSoft = '#7f9684',
                accent = '#86f06f',
                accent2 = '#3bda77',
                accentContrast = '#061008',
                glow = 'rgba(134, 240, 111, 0.25)',
                danger = '#ff6c7b',
                warning = '#efc85b'
            }
        },
        MAZE_BANK = {
            logo = 'img/banks/maze-bank-logo.png', -- replace with your MAZE BANK PNG
            colors = {
                -- luxury / corporate banking look (dark navy + gold accents)
                bg = '#070a12',
                bg2 = '#0f1724',
                surface = 'rgba(13, 20, 34, 0.9)',
                surface2 = 'rgba(8, 13, 24, 0.95)',
                card = 'rgba(18, 26, 42, 0.93)',
                border = 'rgba(214, 178, 104, 0.16)',
                text = '#f6f3ea',
                textMuted = '#cbc1ab',
                textSoft = '#978a72',
                accent = '#d8b56a',
                accent2 = '#a9823e',
                accentContrast = '#110d05',
                glow = 'rgba(216, 181, 106, 0.23)',
                danger = '#d96c70',
                warning = '#e2bb72'
            }
        }
    },
    atms = {
        -- Backwards compatible: plain model hashes still work
        `prop_atm_01`,
        -- Optional per-ATM model branding via `BankConfig` / `bankConfig`
        -- ATM `location` is resolved automatically from the player's current street on open.
        -- { model = `prop_fleeca_atm`, BankConfig = { theme = 'FLEECA', institution = 'FLEECA Bank', contextLabel = 'Geldautomat' } },
        `prop_atm_02`,
        `prop_atm_03`,
        `prop_fleeca_atm`
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
            coords = vector4(149.46, -1042.09, 29.37, 335.43)
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
