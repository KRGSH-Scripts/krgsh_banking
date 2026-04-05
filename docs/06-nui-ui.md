# NUI / Frontend-Dokumentation

## Überblick

Die UI ist als **Single-File Vanilla JavaScript** implementiert (`web/public/app.js`, ~1200 Zeilen). Kein Build-Schritt erforderlich – die Datei ist direkt auslieferbar. Das Rendering erfolgt durch string-basiertes HTML-Template-Rendering und `innerHTML`-Updates.

---

## Technischer Aufbau

| Aspekt | Details |
|---|---|
| Sprache | Vanilla JavaScript (ES2020+) |
| Build | Kein Build-Schritt (keine Abhängigkeiten) |
| Rendering | String-Template + `innerHTML` (kein Virtual DOM) |
| State | Zentrales `state`-Objekt, vollständig erneuerbar |
| Theming | CSS Custom Properties (`--rb-*`), dynamisch gesetzt |
| Fonts | IBM Plex Sans + Manrope (Google Fonts CDN) |

---

## Zentraler State

```js
const state = {
    visible:           false,      // UI-Sichtbarkeit
    loading:           false,      // Lade-Overlay
    atm:               false,      // ATM-Modus (true) oder Bank-Modus (false)
    accounts:          [],         // Array<Account> – vom Server
    selectedAccountId: null,       // Aktives Konto
    txSearch:          '',         // Suchbegriff für Transaktionen
    activeTab:         'overview', // 'overview' | 'transactions' | 'atm'
    locale:            {},         // Übersetzungs-Map vom Server
    currency:          'USD',      // Währungscode
    theme:             { ...DEFAULT_THEME },
    toast:             '',         // Benachrichtigungstext
    modal:             null        // { type: 'deposit'|'withdraw'|'transfer' } | null
};
```

---

## NUI-Message-Protokoll (Server → UI)

### `updateLocale`
```js
{ action: 'updateLocale', translations: {}, currency: 'USD' }
```
Setzt `state.locale` und `state.currency`. Wird beim Einloggen und Ressourcen-Start gesendet.

### `setLoading`
```js
{ action: 'setLoading', status: true }
```
Zeigt/versteckt den Lade-Overlay.

### `setVisible`
```js
{
    action:   'setVisible',
    status:   true,
    accounts: [...],      // Array<Account> vom Server (optional accountNumber)
    loading:  false,
    atm:      false,
    canCreateAccounts: false,  // true wenn Bank-Ped createAccounts hat (kein ATM)
    theme:    { key, name, subtitle, contextLabel, location, logo, colors }
}
```
Haupt-Payload beim Öffnen der UI. Setzt alle relevanten State-Felder und rendert.

> **Hinweis:** Die ausgelieferte UI kann ein React/Vite-Build (`web/public/app.js`) sein; das Nachrichtenprotokoll bleibt kompatibel (`setVisible`, `accountNumber`, `canCreateAccounts`).

### `notify`
```js
{ action: 'notify', status: "Fehlermeldung" }
```
Zeigt einen Toast/Fehler in der UI an.

---

## NUI-Callback-Protokoll (UI → Server)

Die UI kommuniziert mit dem Server via `fetch POST` an `https://${RESOURCE_NAME}/<action>`:

| Action | Payload | Rückgabe |
|---|---|---|
| `closeInterface` | `{}` | `'ok'` |
| `deposit` | `{ fromAccount, amount, comment }` | `Account[]` oder `false` |
| `withdraw` | `{ fromAccount, amount, comment }` | `Account[]` oder `false` |
| `transfer` | `{ fromAccount, amount, comment, stateid }` | `Account[]` oder `false` |
| `createAccount` | `{ displayName }` | `Account[]` oder `false` |

```js
async function postNui(action, payload) {
    const response = await fetch(`https://${RESOURCE_NAME}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify(payload || {})
    });
    return await response.json();
}
```

---

## UI-Tabs

### Overview-Tab (`activeTab = 'overview'`)

Zeigt für das gewählte Konto:
- **Hero-Section:** Kontoname, Maske (`XXXX •••• XXXX`), Saldo, letzter Buchungszeitpunkt
- **Flow-Widget:** Ring-Diagramm (CSS conic-gradient) mit Eingangs-/Ausgangsquote
- **Quick Actions:** Deposit / Withdraw / Transfer Buttons
- **KPI-Grid:** Gesamtsaldo aller Konten, Bargeld, Kontoanzahl, letzte Buchung
- **Analytics-Chart:** Balkendiagramm der letzten 6 Buchungen (CSS-basiert, kein Canvas)
- **Letzte Aktivität:** 5 neueste Transaktionen als Row-Cards

### Transactions-Tab (`activeTab = 'transactions'`)

- Vollständiges Buchungsjournal aller Konten zusammengeführt
- Suchfeld (filtert nach: Nachricht, Trans-ID, Empfänger, Account-ID, Account-Name)
- Responsive Tabelle mit Datum, Konto, Buchung, Beteiligte, Typ, Betrag
- Eingang/Ausgang farblich hervorgehoben

### ATM-Tab (`activeTab = 'atm'`)

Wird aktiviert wenn `state.atm = true`:
- Hero-Section mit Kontostand
- Quick Actions (Deposit/Withdraw/Transfer)
- Schnellbeträge: `[50, 100, 250, 500, 1000, 2500, 5000, 10000, 15000]`
- Letzte 5 Transaktionen

---

## Sidebar

Immer sichtbar (außer im ATM-Modus):
- Bank-Name und Subtitle aus Theme
- Gesamtsaldo + Bargeld
- Ausgewähltes Konto + letzter Aktivitätsstatus
- Kontoliste als klickbare Account-Cards

---

## Account-Card

```js
renderAccountCards(accounts) → HTML-String
```

Jede Card zeigt:
- Kontotyp + Status (aktiv/frozen)
- Kontoname
- Maskierte ID (`XXXX •••• XXXX`)
- Verfügbares Guthaben
- Theme-Tag (PERSONAL / BUSINESS / ACCOUNT)
- Letzte Buchung (relativ)

Klick auf Card → `setSelectedAccount(id)` → Re-render

---

## Action-Modal

Öffnet sich für Deposit/Withdraw/Transfer:

```html
<form data-action-type="deposit|withdraw|transfer">
    <input id="rb-amount"   type="number" ... />
    <input id="rb-comment"  type="text"   ... />
    <input id="rb-stateid"  type="text"   ... />  <!-- nur Transfer -->
</form>
```

Submit → `submitActionForm(form)` → `postNui(type, payload)` → State-Update

---

## Theming-System

### CSS Custom Properties

Die UI verwendet ausschließlich `--rb-*` CSS-Variablen:

| Variable | Beschreibung |
|---|---|
| `--rb-bg` | Haupthintergrundfarbe |
| `--rb-bg-2` | Sekundärer Hintergrund |
| `--rb-surface` | Oberflächen-Overlay |
| `--rb-card` | Karten-Hintergrund |
| `--rb-border` | Rahmenfarben |
| `--rb-text` | Haupttextfarbe |
| `--rb-text-muted` | Abgeschwächter Text |
| `--rb-accent` | Akzentfarbe (Eingang) |
| `--rb-accent-2` | Sekundärer Akzent |
| `--rb-glow` | Glow-Effekt-Farbe |
| `--rb-danger` | Fehler/Ausgang-Farbe |
| `--rb-flow-out` | Ring-Diagramm Ausgang |

### Theme-Anwendung

```js
function applyTheme(theme) {
    const resolved = themeFromPayload(theme);
    // Alle --rb-* Properties auf document.documentElement setzen
    Object.entries(map).forEach(([key, value]) => {
        document.documentElement.style.setProperty(key, value);
    });
}
```

Themes werden bei `setVisible` angewendet. Pro ATM/Ped können unterschiedliche Themes konfiguriert werden.

---

## Lokalisierung in der UI

```js
function t(key, fallback) {
    const value = state.locale && state.locale[key];
    return typeof value === 'string' && value.length > 0 
        ? value 
        : (fallback || FALLBACK_STRINGS[key] || key);
}
```

Dreistufiger Fallback: Locale-Map → `FALLBACK_STRINGS`-Konstante → Schlüssel selbst

`FALLBACK_STRINGS` enthält deutsche Standardtexte als letzten Fallback.

---

## Hilfsfunktionen

| Funktion | Beschreibung |
|---|---|
| `formatMoney(value)` | `Intl.NumberFormat` mit `state.currency` |
| `formatDate(unix)` | `de-DE` Locale: `DD.MM.YY HH:mm` |
| `relativeTime(unix)` | z.B. "Vor 3 Minuten", "Vor 1 Tag" |
| `escapeHtml(value)` | XSS-Schutz für alle Nutzereingaben |
| `accountMask(account)` | `"POLI •••• POLI"` – erste/letzte 4 Zeichen |
| `normalizeAccounts(accounts)` | Typsichere Normalisierung von `amount`, `frozen`, `transactions` |
| `metricsForAccount(account)` | Berechnet `{ inflow, outflow }` |
| `chartBuckets(account)` | Letzte 6 Transaktionen als Balken-Daten |

---

## XSS-Schutz

Alle User-Daten werden durch `escapeHtml()` vor der HTML-Injection geschützt:
```js
function escapeHtml(value) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
```

---

## Event-Delegation

Statt direkter Event-Listener auf Elementen nutzt die UI Event-Delegation auf dem Root:

```js
root.addEventListener('click', (e) => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    // switch(action): select-account, open-modal, close-modal, ...
});
```

---

## Preset-Beträge ATM

```js
const presetAmounts = [50, 100, 250, 500, 1000, 2500, 5000, 10000, 15000];
```

Klick auf Preset → Modal öffnen mit vorausgefülltem Betrag für Withdraw.
