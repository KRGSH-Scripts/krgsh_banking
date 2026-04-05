---
title: "NUI / Frontend"
description: "React 18 + TypeScript SPA mit Mantine UI, TanStack Router/Query und Zustand: Architektur, NUI-Message-Protokoll, Routing, Theming und Build-Prozess."
tags: ["fivem", "banking", "react", "typescript", "ui", "nui", "vite", "mantine"]
order: 6
---

# NUI / Frontend-Dokumentation

## 1. Überblick

Die UI ist eine vollständige **React 18 Single Page Application**, gebaut mit Vite 5 und TypeScript. Der Build-Output (`web/public/`) wird als FiveM NUI-Overlay über CEF ausgeliefert.

| Aspekt | Details |
|---|---|
| Framework | React 18 + TypeScript |
| Build-Tool | Vite 5 |
| UI-Bibliothek | Mantine UI v7 (AppShell, Tabs, Modal, Notifications, …) |
| Routing | TanStack Router v1 (Memory History – kein URL-Routing) |
| Data Fetching | TanStack Query v5 |
| Globaler State | Zustand v5 (`useBankingStore`) |
| Charts | Recharts + `@mantine/charts` |
| Build-Output | `web/public/index.html`, `web/public/assets/*` |

> **FiveM-Hinweis:** Der Router nutzt `createMemoryHistory`. Es gibt keinerlei URL-Navigation – die gesamte SPA läuft im In-Game-CEF-Browser-Overlay.

---

## 2. Architektur & Verzeichnisstruktur

```
web/src/
  main.tsx                   # React Bootstrap: MantineProvider, QueryClientProvider, RouterProvider
  store/
    bankingStore.ts           # Zustand store (useBankingStore)
  routes/
    __root.tsx                # RootLayout: AppShell, Sidebar, TopBar, ActionModal, Toast
    index.tsx                 # Redirect → /overview
    overview.tsx              # Übersichtsseite
    transactions.tsx          # Transaktions-Journal
    atm.tsx                   # ATM-Flow
    schedules.tsx             # Daueraufträge / Recurring Payments
    bank-cards.tsx            # Kartenanzeige und -verwaltung
  components/
    Sidebar/                  # Kontolisten-Sidebar (nur Bank-Modus)
    TopBar.tsx                # Header: Bank-Name, Standort, Schließen-Button
    ActionModal.tsx           # Deposit / Withdraw / Transfer Modal
    Overview/                 # HeroSection, QuickActions, KpiGrid, AnalyticsChart, RecentActivity
    ATM/                      # AtmHero, AtmKeypad, AtmRecent, AtmCardPicker, AtmPinEntry
    Transactions/             # TransactionTable
  lib/
    nui.ts                    # postNui, normalizeAccounts, normalizeAtmCards, isNuiRuntime
    theme.ts                  # DEFAULT_THEME, mergeTheme, applyThemeCssVars
    formatters.ts             # formatMoney, formatDate, relativeTime
    transactionJournal.ts     # getAllTransactions – kontenübergreifendes Journal
  types/                      # TypeScript-Typdefinitionen (Account, Transaction, BankTheme, …)
```

---

## 3. NUI-Message-Protokoll (Server → UI)

Der Client (FiveM Lua) sendet Nachrichten via `SendNUIMessage`. Die React-App empfängt sie über `window.addEventListener('message', ...)` – implementiert im Hook `useNuiMessage()`.

### `updateLocale`

Wird beim Ressourcen-Start und beim Spieler-Login gesendet. Setzt Übersetzungen und Währungskürzel.

```json
{
  "action": "updateLocale",
  "translations": {
    "bank_name": "FLEECA BANK",
    "deposit": "Einzahlen",
    "withdraw": "Abheben"
  },
  "currency": "USD"
}
```

### `setLoading`

Zeigt oder versteckt den globalen Lade-Overlay.

```json
{ "action": "setLoading", "status": true }
```

### `setVisible`

Haupt-Payload beim Öffnen der UI (Bank- oder ATM-Modus).

```json
{
  "action": "setVisible",
  "status": true,
  "accounts": [
    {
      "id": "police",
      "name": "Police Department",
      "type": "org",
      "amount": 150000,
      "frozen": false,
      "transactions": []
    }
  ],
  "loading": false,
  "atm": false,
  "canCreateAccounts": true,
  "theme": {
    "key": "FLEECA",
    "name": "FLEECA BANK",
    "subtitle": "Your trusted partner",
    "contextLabel": "Bank",
    "location": "Downtown",
    "logo": "img/banks/fleeca-logo.png",
    "colors": {
      "accent": "#4ade80",
      "accentContrast": "#000000",
      "bg": "#0a0f0d",
      "bg2": "#111a15"
    }
  }
}
```

Im **ATM-Modus** (`"atm": true`) enthält das Payload zusätzlich `atmCards`, wenn `Config.atmCardsOnly = true`:

```json
{
  "action": "setVisible",
  "status": true,
  "atm": true,
  "atmCards": [
    {
      "accountId": "char1:abc123",
      "cardId": "card_xyz",
      "accountName": "Girokonto",
      "label": "Girokonto (•••• xyz)",
      "needsPin": true
    }
  ],
  "accounts": [],
  "theme": { "..." : "..." }
}
```

### `notify`

Zeigt eine Fehler- oder Status-Benachrichtigung in der UI an (Mantine Notification).

```json
{ "action": "notify", "status": "Nicht genügend Guthaben." }
```

---

## 4. NUI-Callback-Protokoll (UI → Server)

Die UI kommuniziert mit dem Lua-Server via `fetch POST` an `https://{GetParentResourceName()}/{action}`. Implementiert in `lib/nui.ts`:

```ts
async function postNui<T>(action: string, payload?: object): Promise<T | false> {
  const res = await fetch(`https://${GetParentResourceName()}/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify(payload ?? {}),
  });
  const data = await res.json();
  return data ?? false;
}
```

| Action | Payload | Antwort |
|---|---|---|
| `closeInterface` | `{}` | `'ok'` |
| `deposit` | `{ fromAccount, amount, comment }` | `Account[]` \| `false` |
| `withdraw` | `{ fromAccount, amount, comment }` | `Account[]` \| `false` |
| `transfer` | `{ fromAccount, amount, comment, stateid }` | `Account[]` \| `false` |
| `createAccount` | `{ displayName }` | `Account[]` \| `false` |
| `listBankCards` | `{}` | `{ personal: CardEntry[], shared: CardEntry[] }` |
| `issueBankCard` | `{ accountId }` | `Account[]` \| `false` |
| `setBankCardPin` | `{ accountId, cardId, pin }` | result |
| `deleteBankCard` | `{ accountId, cardId }` | result |
| `atmSelectCard` | `{ accountId, cardId, pin? }` | `{ ok, needsPin?, accounts }` |

**Beispiel – Transfer:**
```ts
const accounts = await postNui<Account[]>('transfer', {
  fromAccount: 'police',
  amount: 5000,
  comment: 'Ausrüstung',
  stateid: '4711',
});
if (accounts) queryClient.setQueryData(['banking', 'accounts'], accounts);
```

---

## 5. Globaler State (Zustand)

Der gesamte UI-State wird in einem einzigen Zustand-Store (`useBankingStore`) verwaltet.

```ts
interface BankingState {
  visible: boolean;
  loading: boolean;
  atm: boolean;
  canCreateAccounts: boolean;
  selectedAccountId: string | null;
  atmCards: AtmCardOption[];       // ATM: gefilterte Karten aus Inventory
  locale: Record<string, string>;
  currency: string;
  theme: BankTheme;
  toast: string | null;
  modal: ModalState | null;        // { type: 'deposit'|'withdraw'|'transfer', accountId }
}
```

**Actions:**

| Action | Beschreibung |
|---|---|
| `setVisible(status)` | UI ein-/ausblenden |
| `setLoading(status)` | Lade-Overlay |
| `setSelectedAccountId(id)` | Aktives Konto wechseln |
| `setAtmCards(cards)` | ATM-Kartenliste setzen |
| `setLocale(translations, currency)` | Locale + Währung aktualisieren |
| `showToast(message)` | Toast-Benachrichtigung anzeigen |
| `hideToast()` | Toast ausblenden |
| `openModal(state)` | Action-Modal öffnen |
| `closeModal()` | Action-Modal schließen |

**Verwendung in Komponenten:**
```ts
const { selectedAccountId, setSelectedAccountId } = useBankingStore();
```

---

## 6. Routing (TanStack Router)

Das Routing basiert auf **TanStack Router v1** mit `createMemoryHistory` – es gibt keine URL-basierten Navigationen.

| Route | Komponente | Inhalt |
|---|---|---|
| `/` | `index.tsx` | Redirect → `/overview` |
| `/overview` | `overview.tsx` | HeroSection, QuickActions, KpiGrid, AnalyticsChart, RecentActivity |
| `/transactions` | `transactions.tsx` | TransactionTable mit Suche/Filter |
| `/atm` | `atm.tsx` | AtmCardPicker → AtmPinEntry → AtmKeypad, AtmHero, AtmRecent |
| `/schedules` | `schedules.tsx` | Daueraufträge / Recurring Payments |
| `/bank-cards` | `bank-cards.tsx` | Karten ausstellen, PIN setzen, löschen |

Das Root-Layout (`__root.tsx`) umschließt alle Routen mit:
- **AppShell** (Mantine): Sidebar + Hauptbereich
- **TopBar**: Bank-Name, Standort-Label, Schließen-Button
- **ActionModal**: gemeinsames Deposit/Withdraw/Transfer-Modal
- **Toast**: globale Benachrichtigungen

Die Navigation im ATM-Modus erfolgt ausschließlich über die `/atm`-Route; Sidebar und Bank-spezifische Routen werden ausgeblendet.

---

## 7. Theming-System

### CSS Custom Properties

Das Theming basiert vollständig auf CSS Custom Properties (`--rb-*`), die auf `document.documentElement` gesetzt werden.

| Variable | Beschreibung |
|---|---|
| `--rb-bg` | Haupthintergrund |
| `--rb-bg-2` | Sekundärer Hintergrund |
| `--rb-surface` | Oberflächen-Overlay |
| `--rb-surface-2` | Zweite Oberflächenebene |
| `--rb-card` | Karten-Hintergrund |
| `--rb-border` | Rahmenfarbe |
| `--rb-text` | Primäre Textfarbe |
| `--rb-text-muted` | Abgeschwächter Text |
| `--rb-text-soft` | Weicher Text (Metadaten) |
| `--rb-accent` | Akzentfarbe (Eingang / Primär) |
| `--rb-accent-2` | Sekundärer Akzent |
| `--rb-accent-contrast` | Textfarbe auf Akzent-Hintergrund |
| `--rb-glow` | Glow-Effekt-Farbe |
| `--rb-danger` | Fehler / Ausgang |
| `--rb-warning` | Warnung |
| `--rb-flow-out` | Ausgangs-Indikator |

### Theme-API (`lib/theme.ts`)

```ts
// Default-Theme (FLEECA)
export const DEFAULT_THEME: BankTheme = { ... };

// Deep-Merge eines eingehenden Themes mit dem Basis-Theme
export function mergeTheme(base: BankTheme, incoming: Partial<BankTheme>): BankTheme;

// Wendet ein Theme als CSS Custom Properties an
export function applyThemeCssVars(theme: BankTheme): void;
```

### Konfiguration per Ped/ATM (`config.lua`)

Jeder Bank-Ped und jeder ATM kann ein eigenes Theme erhalten:

```lua
Config.peds = {
    {
        coords = vector4(...),
        model  = 's_m_m_bank_01',
        theme  = {
            key    = 'PACIFIC',
            name   = 'PACIFIC STANDARD',
            colors = { accent = '#f59e0b' }
        }
    }
}
```

Beim Öffnen der UI wird das Theme im `setVisible`-Payload mitgeschickt; `mergeTheme` + `applyThemeCssVars` werden im `useNuiMessage`-Hook aufgerufen.

---

## 8. Hooks

### `useNuiMessage()`

Registriert `window.addEventListener('message', ...)` und verarbeitet alle eingehenden Server-Nachrichten:

| Action | Verhalten |
|---|---|
| `setVisible` | Setzt Store-State (visible, atm, accounts, theme, …); appliziert CSS-Theme |
| `setLoading` | Setzt `loading` im Store |
| `updateLocale` | Aktualisiert `locale` + `currency` im Store |
| `notify` | Ruft `showToast(message)` auf |

```ts
// Nutzung im RootLayout:
useNuiMessage();
```

### `useAccounts()`

TanStack Query Wrapper für die Account-Liste:

```ts
const { data: accounts } = useAccounts();
// Query-Key: ['banking', 'accounts']
// Daten werden nach jedem erfolgreichen Callback-Response aktualisiert
```

### `useLocale()`

Gibt einen `t(key, fallback?)`-Helper zurück:

```ts
const { t } = useLocale();
// t('deposit')          → "Einzahlen" (aus locale map)
// t('unknown_key', '-') → "-" (fallback)
```

Dreistufiger Fallback: `locale[key]` → `fallback` → `key` selbst.

---

## 9. Komponenten-Übersicht

### RootLayout (`routes/__root.tsx`)
AppShell-Wrapper mit Sidebar, TopBar, ActionModal und globalem Toast. Enthält `useNuiMessage()`.

### Sidebar (`components/Sidebar/`)
Nur im Bank-Modus sichtbar. Zeigt:
- Bank-Name + Subtitle (aus Theme)
- Gesamtsaldo aller Konten + Bargeld
- Liste aller Konten als klickbare Cards (inkl. Typ, Saldo, Status)

### TopBar (`components/TopBar.tsx`)
Header-Zeile mit Bank-Name, Standort-Label (`theme.contextLabel + theme.location`) und Schließen-Button (sendet `closeInterface`).

### ActionModal (`components/ActionModal.tsx`)
Gemeinsames Mantine-Modal für Deposit / Withdraw / Transfer. Liest `modal`-State aus Store; sendet `postNui` und aktualisiert Account-Query.

### Overview-Komponenten (`components/Overview/`)

| Komponente | Beschreibung |
|---|---|
| `HeroSection` | Kontoname, maskierte ID, Saldo, letzter Buchungszeitpunkt |
| `QuickActions` | Deposit / Withdraw / Transfer Buttons |
| `KpiGrid` | Gesamtsaldo, Bargeld, Kontoanzahl, letzte Buchung |
| `AnalyticsChart` | Recharts-Balkendiagramm der letzten Transaktionen |
| `RecentActivity` | 5 neueste Transaktionen als Row-Cards |

### ATM-Komponenten (`components/ATM/`)

| Komponente | Beschreibung |
|---|---|
| `AtmCardPicker` | Kartenauswahl (nur wenn `atmCardsOnly = true`) |
| `AtmPinEntry` | PIN-Eingabe wenn `needsPin = true` |
| `AtmKeypad` | Numpad für schnelle Betragsauswahl |
| `AtmHero` | Kontostand-Anzeige im ATM-Modus |
| `AtmRecent` | Letzte Transaktionen im ATM-Modus |

### TransactionTable (`components/Transactions/`)
Vollständiges Buchungsjournal (alle Konten zusammengeführt via `getAllTransactions`). Enthält Suchfeld (filtert nach Nachricht, Trans-ID, Empfänger, Konto-ID/-Name) und farblich hervorgehobene Eingangs-/Ausgangszeilen.

---

## 10. Build-Prozess

### Voraussetzungen

```bash
cd web
npm install
```

### Produktions-Build

```bash
cd web && npm run build
# oder aus dem Repo-Root:
./build.sh
```

Output: `web/public/index.html`, `web/public/assets/*`

### Build-Konfiguration (`vite.config.ts`)

- `base: './'` – relative Pfade für FiveM NUI
- Output: `web/public/`
- TypeScript-Pfad-Aliase (`@/` → `src/`)

> **Wichtig:** Generierte Dateien unter `web/public/` nicht manuell editieren. Änderungen immer in `web/src/` vornehmen und neu bauen.

---

## 11. Lokalisierung in der UI

Lokalisierungsstrings werden beim Ressourcen-Start via `updateLocale`-Message gesetzt und im Zustand-Store unter `locale` gespeichert. Der `useLocale()`-Hook stellt den `t(key, fallback?)`-Helper bereit.

```ts
const { t } = useLocale();

<Button>{t('deposit')}</Button>
<Text>{t('balance_label', 'Kontostand')}</Text>
```

Alle Locale-Keys sind in `locales/en.json` definiert. Neue UI-Texte müssen zuerst als Key in `en.json` (und allen anderen Locale-Dateien) angelegt werden.

---

## 12. Entwickler-Preview (Vite Browser Dev Mode)

Im Browser-Dev-Mode (ohne FiveM-Laufzeitumgebung) wird `isNuiRuntime()` als `false` erkannt. Die App lädt dann Mock-Daten aus `lib/nui.ts` (Dev-Fixtures) statt echte NUI-Callbacks zu senden.

```bash
cd web
npm run dev
# → http://localhost:5173
```

Zum Testen verschiedener Themes und Mock-Accounts können die Dev-Fixtures in `lib/nui.ts` angepasst werden. Alle Routen sind über die Sidebar-Navigation erreichbar. Der ATM-Modus kann durch Setzen von `atm: true` im Mock-State simuliert werden.
