(function () {
    'use strict';

    const RESOURCE_NAME = typeof GetParentResourceName === 'function' ? GetParentResourceName() : 'krgsh_banking';

    const DEFAULT_THEME = {
        key: 'DEFAULT',
        name: 'Los Santos Banking',
        subtitle: 'Online Banking',
        contextLabel: 'Bank',
        location: '',
        logo: '',
        colors: {
            bg: '#050505',
            bg2: '#0c0c0c',
            surface: 'rgba(255, 255, 255, 0.035)',
            surface2: 'rgba(255, 255, 255, 0.02)',
            card: 'rgba(14, 14, 14, 0.94)',
            border: 'rgba(255, 255, 255, 0.09)',
            text: '#e5e7eb',
            textMuted: '#9ca3af',
            textSoft: '#6b7280',
            accent: '#f472b6',
            accent2: '#db2777',
            accentContrast: '#ffffff',
            glow: 'rgba(244, 114, 182, 0.32)',
            danger: '#fb7185',
            warning: '#fbbf24',
            flowRingOut: 'rgba(251, 113, 133, 0.28)'
        }
    };

    const FALLBACK_STRINGS = {
        dashboard: 'Kontouebersicht',
        transactionLog: 'Buchungen',
        atm: 'Automat',
        recentTransactions: 'Letzte Buchungen',
        allTransactions: 'Buchungsjournal',
        transactionSearch: 'Buchung suchen...',
        noTransactions: 'Keine Buchungen gefunden',
        portfolio: 'Konten',
        quickActions: 'Schnellaktionen',
        performance: 'Buchungsbewegung',
        inflow: 'Eingaenge',
        outflow: 'Ausgaenge',
        totalBalance: 'Gesamtguthaben',
        availableCash: 'Bargeld',
        accountCount: 'Konten',
        selectedAccount: 'Aktives Konto',
        branch: 'Filiale',
        institution: 'Institut',
        receiver: 'Empfaenger / Konto',
        txId: 'Trans-ID',
        date: 'Zeit',
        accountLabel: 'Konto',
        amountLabel: 'Betrag',
        commentLabel: 'Verwendungszweck',
        messageLabel: 'Buchung',
        actorLabel: 'Beteiligte',
        typeLabel: 'Typ',
        statusLabel: 'Status',
        atmTerminal: 'Self-Service',
        keypad: 'Schnellbetraege',
        customTransfer: 'Individuelle Buchung',
        submit: 'Bestaetigen',
        close: 'Schliessen',
        homebanking: 'Homebanking',
        modeBank: 'Bank',
        modeAtm: 'Geldautomat',
        selected: 'Ausgewaehlt',
        noAccounts: 'Keine Konten vorhanden',
        loading: 'Kontodaten werden geladen...',
        actionDeposit: 'Einzahlen',
        actionWithdraw: 'Abheben',
        actionTransfer: 'Ueberweisen',
        actionModalHint: 'Aktionen werden weiterhin serverseitig geprueft.',
        amountPlaceholder: '0',
        commentPlaceholder: 'Optionaler Verwendungszweck',
        stateIdPlaceholder: 'CitizenID / Konto-ID'
    };

    const state = {
        visible: false,
        loading: false,
        atm: false,
        accounts: [],
        selectedAccountId: null,
        txSearch: '',
        activeTab: 'overview',
        locale: {},
        currency: 'USD',
        theme: { ...DEFAULT_THEME },
        toast: '',
        modal: null,
        previewBooted: false
    };

    const root = document.getElementById('app');
    if (!root) return;

    function t(key, fallback) {
        const value = state.locale && state.locale[key];
        return typeof value === 'string' && value.length > 0 ? value : (fallback || FALLBACK_STRINGS[key] || key);
    }

    function escapeHtml(value) {
        const str = value == null ? '' : String(value);
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function formatMoney(value) {
        const amount = Number(value) || 0;
        try {
            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: state.currency || 'USD',
                maximumFractionDigits: 0
            }).format(amount);
        } catch (_err) {
            return `$${Math.round(amount).toLocaleString('en-US')}`;
        }
    }

    function formatDate(unix) {
        if (!unix) return '-';
        const date = new Date(Number(unix) * 1000);
        if (Number.isNaN(date.getTime())) return '-';
        return date.toLocaleString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function relativeTime(unix) {
        if (!unix) return '-';
        const seconds = Math.max(0, Math.floor(Date.now() / 1000) - Number(unix));
        if (seconds < 60) return t('secs', 'Gerade eben');
        const mins = Math.floor(seconds / 60);
        if (mins < 60) return mins === 1 ? t('amin', 'Vor 1 Minute') : t('mins', 'Vor %s Minuten').replace('%s', mins);
        const hours = Math.floor(mins / 60);
        if (hours < 24) return hours === 1 ? t('ahour', 'Vor 1 Stunde') : t('hours', 'Vor %s Stunden').replace('%s', hours);
        const days = Math.floor(hours / 24);
        if (days < 7) return days === 1 ? t('aday', 'Vor 1 Tag') : t('days', 'Vor %s Tagen').replace('%s', days);
        const weeks = Math.floor(days / 7);
        return weeks === 1 ? t('aweek', 'Vor 1 Woche') : t('weeks', 'Vor %s Wochen').replace('%s', weeks);
    }

    function normalizeAccounts(accounts) {
        if (!Array.isArray(accounts)) return [];
        return accounts.map((account) => ({
            ...account,
            amount: Number(account.amount) || 0,
            frozen: Number(account.frozen) || 0,
            transactions: Array.isArray(account.transactions) ? account.transactions : []
        }));
    }

    function getSelectedAccount() {
        if (!state.accounts.length) return null;
        return state.accounts.find((account) => account.id === state.selectedAccountId) || state.accounts[0] || null;
    }

    function setSelectedAccount(id) {
        state.selectedAccountId = id;
        render();
    }

    function getAllTransactions() {
        return state.accounts.flatMap((account) => {
            const transactions = Array.isArray(account.transactions) ? account.transactions : [];
            return transactions.map((tx) => ({ ...tx, __accountId: account.id, __accountName: account.name }));
        }).sort((a, b) => (Number(b.time) || 0) - (Number(a.time) || 0));
    }

    function getFilteredTransactions() {
        const query = state.txSearch.trim().toLowerCase();
        const account = getSelectedAccount();
        const list = state.activeTab === 'transactions' ? getAllTransactions() : ((account && account.transactions) || []);
        if (!query) return list;
        return list.filter((tx) => {
            const haystack = [
                tx.title,
                tx.trans_id,
                tx.receiver,
                tx.message,
                tx.issuer,
                tx.__accountId,
                tx.__accountName
            ].filter(Boolean).join(' ').toLowerCase();
            return haystack.includes(query);
        });
    }

    function sumAccountBalances() {
        return state.accounts.reduce((sum, account) => sum + (Number(account.amount) || 0), 0);
    }

    function getCashBalance() {
        const personal = state.accounts.find((account) => typeof account.cash === 'number');
        return personal ? Number(personal.cash) || 0 : 0;
    }

    function latestTransaction() {
        return getAllTransactions()[0] || null;
    }

    function metricsForAccount(account) {
        const transactions = Array.isArray(account && account.transactions) ? account.transactions : [];
        let inflow = 0;
        let outflow = 0;
        for (const tx of transactions) {
            const amount = Math.abs(Number(tx.amount) || 0);
            if ((tx.trans_type || '').toLowerCase() === 'deposit') inflow += amount;
            else outflow += amount;
        }
        return { inflow, outflow };
    }

    function chartBuckets(account) {
        const transactions = Array.isArray(account && account.transactions) ? account.transactions.slice(0, 6) : [];
        const reversed = transactions.reverse();
        const max = Math.max(1, ...reversed.map((tx) => Math.abs(Number(tx.amount) || 0)));
        return reversed.map((tx, index) => ({
            label: String(index + 1),
            value: Math.abs(Number(tx.amount) || 0),
            pct: Math.max(10, Math.round((Math.abs(Number(tx.amount) || 0) / max) * 100)),
            type: (tx.trans_type || '').toLowerCase() === 'deposit' ? 'in' : 'out'
        }));
    }

    function themeFromPayload(payload) {
        const incoming = payload && typeof payload === 'object' ? payload : {};
        const incomingColors = incoming.colors && typeof incoming.colors === 'object' ? incoming.colors : {};
        return {
            ...DEFAULT_THEME,
            ...incoming,
            colors: {
                ...DEFAULT_THEME.colors,
                ...incomingColors
            }
        };
    }

    function applyTheme(theme) {
        const resolved = themeFromPayload(theme);
        state.theme = resolved;

        const map = {
            '--rb-bg': resolved.colors.bg,
            '--rb-bg-2': resolved.colors.bg2,
            '--rb-surface': resolved.colors.surface,
            '--rb-surface-2': resolved.colors.surface2,
            '--rb-card': resolved.colors.card,
            '--rb-border': resolved.colors.border,
            '--rb-text': resolved.colors.text,
            '--rb-text-muted': resolved.colors.textMuted,
            '--rb-text-soft': resolved.colors.textSoft,
            '--rb-accent': resolved.colors.accent,
            '--rb-accent-2': resolved.colors.accent2,
            '--rb-accent-contrast': resolved.colors.accentContrast,
            '--rb-glow': resolved.colors.glow,
            '--rb-danger': resolved.colors.danger,
            '--rb-warning': resolved.colors.warning,
            '--rb-flow-out': resolved.colors.flowRingOut || 'rgba(251, 113, 133, 0.28)'
        };

        Object.entries(map).forEach(([key, value]) => {
            if (value) document.documentElement.style.setProperty(key, value);
        });
    }

    function accountTone(account) {
        if (!account) return t('account', 'Konto');
        const type = String(account.type || '').toLowerCase();
        if (type.includes('personal')) return t('pers_account', 'Privatkonto');
        if (type.includes('org')) return t('soc_account', 'Geschaeftskonto');
        return account.type || t('account', 'Konto');
    }

    function accountMask(account) {
        if (!account) return '---- ----';
        const raw = String(account.id || '').replace(/\s+/g, '').toUpperCase();
        const head = raw.slice(0, 4) || 'BANK';
        const tail = raw.slice(-4) || '0000';
        return `${head} •••• ${tail}`;
    }

    function lastBookingLabel(account) {
        const tx = account && Array.isArray(account.transactions) ? account.transactions[0] : null;
        return tx ? relativeTime(tx.time) : t('trans_not_found', FALLBACK_STRINGS.noTransactions);
    }

    function themeTag(account) {
        if (!account) return 'ACCOUNT';
        const type = String(account.type || '').toLowerCase();
        if (type.includes('personal')) return 'PERSONAL';
        if (type.includes('org')) return 'BUSINESS';
        return String(account.type || 'ACCOUNT').toUpperCase();
    }

    async function postNui(action, payload) {
        try {
            const response = await fetch(`https://${RESOURCE_NAME}/${action}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json; charset=UTF-8'
                },
                body: JSON.stringify(payload || {})
            });
            return await response.json();
        } catch (_err) {
            return false;
        }
    }

    async function closeUi() {
        state.visible = false;
        state.modal = null;
        render();
        await postNui('closeInterface', {});
    }

    function openActionModal(type) {
        const account = getSelectedAccount();
        if (!account) return;
        state.modal = { type };
        render();
        const amountInput = root.querySelector('#rb-amount');
        if (amountInput) amountInput.focus();
    }

    function closeActionModal() {
        state.modal = null;
        render();
    }

    async function submitActionForm(form) {
        const account = getSelectedAccount();
        if (!account) return;

        const amountValue = Number(form.amount.value);
        const payload = {
            fromAccount: account.id,
            amount: Number.isFinite(amountValue) ? amountValue : 0,
            comment: (form.comment.value || '').trim(),
            stateid: (form.stateid && form.stateid.value ? form.stateid.value.trim() : '')
        };

        const type = form.dataset.actionType;
        if (!type) return;

        state.loading = true;
        render();

        const nextAccounts = await postNui(type, payload);
        if (nextAccounts !== false) {
            state.accounts = normalizeAccounts(nextAccounts);
            if (!state.accounts.some((entry) => entry.id === state.selectedAccountId)) {
                state.selectedAccountId = state.accounts[0] ? state.accounts[0].id : null;
            }
            state.modal = null;
        }

        state.loading = false;
        render();
    }

    function txTypeBadge(txType) {
        const isIn = (txType || '').toLowerCase() === 'deposit';
        return `<span class="rb-pill ${isIn ? 'is-in' : 'is-out'}">${escapeHtml(isIn ? t('deposit_but', FALLBACK_STRINGS.actionDeposit) : t('withdraw_but', FALLBACK_STRINGS.actionWithdraw))}</span>`;
    }

    function txAmountCell(tx) {
        const isIn = (tx.trans_type || '').toLowerCase() === 'deposit';
        const sign = isIn ? '+' : '-';
        return `<span class="${isIn ? 'rb-rowCard__amount is-in' : 'rb-rowCard__amount is-out'}">${sign}${escapeHtml(formatMoney(tx.amount))}</span>`;
    }

    function renderAccountCards(accounts) {
        if (!accounts.length) {
            return `
                <div class="rb-empty rb-empty--compact">
                    <p class="rb-empty__title">${escapeHtml(FALLBACK_STRINGS.noAccounts)}</p>
                    <p>${escapeHtml(t('loading_failed', 'Konten konnten nicht geladen werden.'))}</p>
                </div>
            `;
        }

        return accounts.map((account) => {
            const selected = account.id === state.selectedAccountId;
            return `
                <button class="rb-accountCard ${selected ? 'is-active' : ''}" data-action="select-account" data-account-id="${escapeHtml(account.id)}" type="button">
                    <div class="rb-accountCard__head">
                        <span class="rb-accountCard__type">${escapeHtml(accountTone(account))}</span>
                        ${account.frozen ? `<span class="rb-status is-danger">${escapeHtml(t('frozen', 'Gesperrt'))}</span>` : `<span class="rb-status is-success">${escapeHtml(t('available', 'Aktiv'))}</span>`}
                    </div>
                    <p class="rb-accountCard__name">${escapeHtml(account.name || account.id)}</p>
                    <p class="rb-accountCard__id">${escapeHtml(accountMask(account))}</p>
                    <div class="rb-accountCard__row">
                        <div>
                            <p class="rb-accountCard__meta">${escapeHtml(t('available_balance', 'Verfuegbar'))}</p>
                            <p class="rb-accountCard__balance">${escapeHtml(formatMoney(account.amount))}</p>
                        </div>
                        <div class="rb-accountCard__tail">
                            <span class="rb-accountCard__pill">${escapeHtml(themeTag(account))}</span>
                            <span class="rb-accountCard__meta">${escapeHtml(lastBookingLabel(account))}</span>
                        </div>
                    </div>
                </button>
            `;
        }).join('');
    }

    function renderQuickActions() {
        const actions = [
            { type: 'deposit', icon: '+', title: t('deposit_but', FALLBACK_STRINGS.actionDeposit), sub: 'Cash auf Konto' },
            { type: 'withdraw', icon: '-', title: t('withdraw_but', FALLBACK_STRINGS.actionWithdraw), sub: 'Konto auf Cash' },
            { type: 'transfer', icon: '->', title: t('transfer_but', FALLBACK_STRINGS.actionTransfer), sub: 'An Konto oder CitizenID' }
        ];

        return `
            <div class="rb-actionRow">
                ${actions.map((action) => `
                    <button type="button" class="rb-actionCard" data-action="open-modal" data-modal-type="${action.type}">
                        <span class="rb-actionCard__icon">${escapeHtml(action.icon)}</span>
                        <span class="rb-actionCard__body">
                            <strong>${escapeHtml(action.title)}</strong>
                            <span>${escapeHtml(action.sub)}</span>
                        </span>
                    </button>
                `).join('')}
            </div>
        `;
    }

    function renderSidebar(selectedAccount) {
        const theme = state.theme || DEFAULT_THEME;
        const latest = latestTransaction();
        return `
            <aside class="rb-sidebar">
                <section class="rb-sidebarCard rb-sidebarCard--intro">
                    <p class="rb-sidebarCard__eyebrow">${escapeHtml(FALLBACK_STRINGS.portfolio)}</p>
                    <h2 class="rb-sidebarCard__title">${escapeHtml(theme.name || t('bank_name', 'Los Santos Banking'))}</h2>
                    <p class="rb-sidebarCard__text">${escapeHtml(theme.subtitle || FALLBACK_STRINGS.homebanking)}</p>
                    <div class="rb-sidebarHighlights">
                        <div class="rb-miniStat">
                            <span>${escapeHtml(FALLBACK_STRINGS.totalBalance)}</span>
                            <strong>${escapeHtml(formatMoney(sumAccountBalances()))}</strong>
                        </div>
                        <div class="rb-miniStat">
                            <span>${escapeHtml(t('cash', FALLBACK_STRINGS.availableCash))}</span>
                            <strong>${escapeHtml(formatMoney(getCashBalance()))}</strong>
                        </div>
                    </div>
                </section>

                <section class="rb-sidebarCard">
                    <div class="rb-sidebarCard__split">
                        <div>
                            <p class="rb-sidebarCard__eyebrow">${escapeHtml(FALLBACK_STRINGS.selectedAccount)}</p>
                            <strong class="rb-sidebarCard__value">${escapeHtml(selectedAccount ? (selectedAccount.name || selectedAccount.id) : '-')}</strong>
                        </div>
                        <span class="rb-status">${escapeHtml(state.atm ? FALLBACK_STRINGS.modeAtm : FALLBACK_STRINGS.modeBank)}</span>
                    </div>
                    <p class="rb-sidebarCard__text">${escapeHtml(latest ? `Letzte Aktivitaet ${relativeTime(latest.time)}` : FALLBACK_STRINGS.noTransactions)}</p>
                </section>

                <section class="rb-sidebarCard rb-sidebarCard--list">
                    <div class="rb-sidebarCard__split">
                        <div>
                            <p class="rb-sidebarCard__eyebrow">${escapeHtml(FALLBACK_STRINGS.accountCount)}</p>
                            <strong class="rb-sidebarCard__value">${escapeHtml(String(state.accounts.length))}</strong>
                        </div>
                        <span class="rb-sidebarCard__text">${escapeHtml(t('select_account', 'Konto auswaehlen'))}</span>
                    </div>
                    <div class="rb-accountList">${renderAccountCards(state.accounts)}</div>
                </section>
            </aside>
        `;
    }

    function renderOverview(selectedAccount) {
        const theme = state.theme || DEFAULT_THEME;
        if (!selectedAccount) {
            return `<div class="rb-empty"><p class="rb-empty__title">${escapeHtml(FALLBACK_STRINGS.noAccounts)}</p></div>`;
        }

        const txs = Array.isArray(selectedAccount.transactions) ? selectedAccount.transactions : [];
        const recent = txs.slice(0, 5);
        const stats = metricsForAccount(selectedAccount);
        const bars = chartBuckets(selectedAccount);
        const latest = txs[0];
        const flowTotal = Math.max(1, stats.inflow + stats.outflow);
        const inflowPct = Math.round((stats.inflow / flowTotal) * 100);

        return `
            <div class="rb-stack">
                <section class="rb-hero">
                    <div class="rb-hero__main">
                        <div>
                            <div class="rb-hero__eyebrowRow">
                                <span class="rb-status">${escapeHtml(themeTag(selectedAccount))}</span>
                                <span class="rb-hero__route">${escapeHtml(accountMask(selectedAccount))}</span>
                            </div>
                            <h2 class="rb-hero__title">${escapeHtml(selectedAccount.name || selectedAccount.id)}</h2>
                            <p class="rb-hero__desc">${escapeHtml(accountTone(selectedAccount))} · ${escapeHtml(selectedAccount.id)}${theme.location ? ` · ${escapeHtml(theme.location)}` : ''}</p>
                            <p class="rb-hero__amount">${escapeHtml(formatMoney(selectedAccount.amount))}</p>
                            <div class="rb-hero__metaRow">
                                <div class="rb-balanceMeta">
                                    <span>${escapeHtml(t('available_balance', 'Verfuegbarer Kontostand'))}</span>
                                    <strong>${escapeHtml(formatMoney(selectedAccount.amount))}</strong>
                                </div>
                                <div class="rb-balanceMeta">
                                    <span>${escapeHtml(FALLBACK_STRINGS.date)}</span>
                                    <strong>${escapeHtml(latest ? relativeTime(latest.time) : 'Keine letzte Buchung')}</strong>
                                </div>
                            </div>
                        </div>
                        <div class="rb-hero__side">
                            <div class="rb-flowWidget">
                                <div class="rb-flowWidget__ring" style="background: conic-gradient(var(--rb-accent) 0 ${inflowPct}%, var(--rb-flow-out) ${inflowPct}% 100%);">
                                    <div class="rb-flowWidget__inner">
                                        <strong>${escapeHtml(`${inflowPct}%`)}</strong>
                                        <span>${escapeHtml(FALLBACK_STRINGS.inflow)}</span>
                                    </div>
                                </div>
                                <div class="rb-flowWidget__legend">
                                    <div class="rb-flowWidget__item">
                                        <span class="rb-flowWidget__swatch is-in"></span>
                                        <span>${escapeHtml(FALLBACK_STRINGS.inflow)}</span>
                                        <strong>${escapeHtml(formatMoney(stats.inflow))}</strong>
                                    </div>
                                    <div class="rb-flowWidget__item">
                                        <span class="rb-flowWidget__swatch is-out"></span>
                                        <span>${escapeHtml(FALLBACK_STRINGS.outflow)}</span>
                                        <strong>${escapeHtml(formatMoney(stats.outflow))}</strong>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section class="rb-card rb-card--actions">
                    <div class="rb-sectionHead">
                        <div>
                            <p class="rb-card__eyebrow">${escapeHtml(FALLBACK_STRINGS.quickActions)}</p>
                            <h3 class="rb-sectionHead__title">${escapeHtml(t('daily_banking', 'Taegliches Banking'))}</h3>
                        </div>
                        <p class="rb-sectionHead__copy">${escapeHtml(FALLBACK_STRINGS.actionModalHint)}</p>
                    </div>
                    ${renderQuickActions()}
                </section>

                <section class="rb-kpiGrid">
                    <article class="rb-card">
                        <p class="rb-card__eyebrow">${escapeHtml(FALLBACK_STRINGS.totalBalance)}</p>
                        <p class="rb-card__value">${escapeHtml(formatMoney(sumAccountBalances()))}</p>
                        <p class="rb-card__meta">${escapeHtml('Alle verknuepften Konten')}</p>
                    </article>
                    <article class="rb-card">
                        <p class="rb-card__eyebrow">${escapeHtml(t('cash', 'Bargeld'))}</p>
                        <p class="rb-card__value">${escapeHtml(formatMoney(getCashBalance()))}</p>
                        <p class="rb-card__meta">${escapeHtml('Sofort verfuegbar')}</p>
                    </article>
                    <article class="rb-card">
                        <p class="rb-card__eyebrow">${escapeHtml(FALLBACK_STRINGS.accountCount)}</p>
                        <p class="rb-card__value">${escapeHtml(state.accounts.length)}</p>
                        <p class="rb-card__meta">${escapeHtml('Freigeschaltete Konten')}</p>
                    </article>
                    <article class="rb-card">
                        <p class="rb-card__eyebrow">${escapeHtml(FALLBACK_STRINGS.date)}</p>
                        <p class="rb-card__value">${escapeHtml(latest ? formatDate(latest.time) : '-')}</p>
                        <p class="rb-card__meta">${escapeHtml(latest ? latest.message || latest.title || 'Letzte Buchung' : FALLBACK_STRINGS.noTransactions)}</p>
                    </article>
                </section>

                <section class="rb-overviewGrid">
                    <article class="rb-card rb-card--analytics">
                        <div class="rb-sectionHead">
                            <div>
                                <p class="rb-card__eyebrow">${escapeHtml(FALLBACK_STRINGS.performance)}</p>
                                <h3 class="rb-sectionHead__title">${escapeHtml('Bewegung der letzten Buchungen')}</h3>
                            </div>
                            <p class="rb-sectionHead__copy">${escapeHtml('Die letzten sechs Buchungen des ausgewaehlten Kontos.')}</p>
                        </div>
                        <div class="rb-chart">
                            ${bars.map((bar) => `
                                <div class="rb-chart__item">
                                    <div class="rb-chart__rail">
                                        <div class="rb-chart__fill ${bar.type === 'in' ? 'is-in' : 'is-out'}" style="height:${bar.pct}%"></div>
                                    </div>
                                    <span class="rb-chart__label">${escapeHtml(bar.label)}</span>
                                </div>
                            `).join('') || '<div class="rb-empty rb-empty--compact">-</div>'}
                        </div>
                    </article>

                    <article class="rb-card rb-card--ledger">
                        <div class="rb-sectionHead">
                            <div>
                                <p class="rb-card__eyebrow">${escapeHtml(FALLBACK_STRINGS.recentTransactions)}</p>
                                <h3 class="rb-sectionHead__title">${escapeHtml('Letzte Aktivitaet')}</h3>
                            </div>
                            <p class="rb-sectionHead__copy">${escapeHtml(selectedAccount.id)}</p>
                        </div>
                        <div class="rb-list">
                            ${recent.length ? recent.map((tx) => {
                                const isIn = (tx.trans_type || '').toLowerCase() === 'deposit';
                                return `
                                    <article class="rb-rowCard">
                                        <div class="rb-rowCard__icon ${isIn ? 'is-in' : 'is-out'}">${isIn ? '+' : '-'}</div>
                                        <div>
                                            <p class="rb-rowCard__title">${escapeHtml(tx.message || tx.title || 'Buchung')}</p>
                                            <p class="rb-rowCard__sub">${escapeHtml(tx.receiver || tx.issuer || '-')}</p>
                                            <p class="rb-rowCard__sub">${escapeHtml(formatDate(tx.time))}</p>
                                        </div>
                                        <div>
                                            ${txAmountCell(tx)}
                                            <p class="rb-rowCard__sub">${escapeHtml(relativeTime(tx.time))}</p>
                                        </div>
                                    </article>
                                `;
                            }).join('') : `
                                <div class="rb-empty rb-empty--compact">
                                    <p class="rb-empty__title">${escapeHtml(FALLBACK_STRINGS.noTransactions)}</p>
                                </div>
                            `}
                        </div>
                    </article>
                </section>
            </div>
        `;
    }

    function renderTransactions() {
        const transactions = getFilteredTransactions();
        return `
            <section class="rb-card rb-card--table">
                <div class="rb-tableHead">
                    <div>
                        <p class="rb-card__eyebrow">${escapeHtml(FALLBACK_STRINGS.allTransactions)}</p>
                        <h3 class="rb-sectionHead__title">${escapeHtml('Kontojournal')}</h3>
                        <p class="rb-sectionHead__copy">${escapeHtml('Suche in Nachricht, Trans-ID, Empfaenger oder Konto-ID.')}</p>
                    </div>
                    <input class="rb-search" type="search" value="${escapeHtml(state.txSearch)}" placeholder="${escapeHtml(t('trans_search', FALLBACK_STRINGS.transactionSearch))}" data-action="search-tx" />
                </div>
                ${transactions.length ? `
                    <div class="rb-tableWrap">
                        <table class="rb-txTable">
                            <thead>
                                <tr>
                                    <th>${escapeHtml(FALLBACK_STRINGS.date)}</th>
                                    <th>${escapeHtml(FALLBACK_STRINGS.accountLabel)}</th>
                                    <th>${escapeHtml(FALLBACK_STRINGS.messageLabel)}</th>
                                    <th>${escapeHtml(FALLBACK_STRINGS.actorLabel)}</th>
                                    <th>${escapeHtml(FALLBACK_STRINGS.typeLabel)}</th>
                                    <th>${escapeHtml(FALLBACK_STRINGS.amountLabel)}</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${transactions.map((tx) => {
                                    const isIn = (tx.trans_type || '').toLowerCase() === 'deposit';
                                    const sign = isIn ? '+' : '-';
                                    return `
                                        <tr>
                                            <td data-label="${escapeHtml(FALLBACK_STRINGS.date)}">
                                                <strong>${escapeHtml(formatDate(tx.time))}</strong><br />
                                                <span class="rb-rowCard__sub">${escapeHtml(relativeTime(tx.time))}</span>
                                            </td>
                                            <td data-label="${escapeHtml(FALLBACK_STRINGS.accountLabel)}">
                                                <strong>${escapeHtml(tx.__accountName || tx.title || tx.__accountId || '-')}</strong><br />
                                                <span class="rb-rowCard__sub">${escapeHtml(tx.__accountId || '-')}</span>
                                            </td>
                                            <td data-label="${escapeHtml(FALLBACK_STRINGS.messageLabel)}">
                                                <strong>${escapeHtml(tx.message || tx.title || '-')}</strong><br />
                                                <span class="rb-rowCard__sub">${escapeHtml(tx.title || '-')}</span><br />
                                                <span class="rb-rowCard__sub">${escapeHtml(tx.trans_id || '-')}</span>
                                            </td>
                                            <td data-label="${escapeHtml(FALLBACK_STRINGS.actorLabel)}">
                                                <span>${escapeHtml(tx.issuer || '-')}</span><br />
                                                <span class="rb-rowCard__sub">${escapeHtml(tx.receiver || '-')}</span>
                                            </td>
                                            <td data-label="${escapeHtml(FALLBACK_STRINGS.typeLabel)}">${txTypeBadge(tx.trans_type)}</td>
                                            <td data-label="${escapeHtml(FALLBACK_STRINGS.amountLabel)}">
                                                <span class="${isIn ? 'rb-rowCard__amount is-in' : 'rb-rowCard__amount is-out'}">${sign}${escapeHtml(formatMoney(tx.amount))}</span>
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : `
                    <div class="rb-empty">
                        <p class="rb-empty__title">${escapeHtml(t('trans_not_found', FALLBACK_STRINGS.noTransactions))}</p>
                    </div>
                `}
            </section>
        `;
    }

    function renderAtmTab(selectedAccount) {
        const txs = selectedAccount && Array.isArray(selectedAccount.transactions) ? selectedAccount.transactions.slice(0, 5) : [];
        const presetAmounts = [50, 100, 250, 500, 1000, 2500, 5000, 10000, 15000];

        return `
            <div class="rb-atmView">
                <section class="rb-hero rb-hero--atm">
                    <div class="rb-hero__main">
                        <div>
                            <div class="rb-hero__eyebrowRow">
                                <span class="rb-status">${escapeHtml(FALLBACK_STRINGS.atmTerminal)}</span>
                                <span class="rb-hero__route">${escapeHtml(selectedAccount ? accountMask(selectedAccount) : '---- ----')}</span>
                            </div>
                            <h2 class="rb-hero__title">${escapeHtml(selectedAccount ? (selectedAccount.name || selectedAccount.id) : 'Kein Konto')}</h2>
                            <p class="rb-hero__desc">${escapeHtml('Schneller Zugriff auf Basisfunktionen mit vertrauter Homebanking-Struktur.')}</p>
                            <p class="rb-hero__amount">${escapeHtml(selectedAccount ? formatMoney(selectedAccount.amount) : formatMoney(0))}</p>
                        </div>
                        <div class="rb-atmSummary">
                            <span>${escapeHtml('Verfuegbar')}</span>
                            <strong>${escapeHtml(selectedAccount ? formatMoney(selectedAccount.amount) : formatMoney(0))}</strong>
                            <p>${escapeHtml(selectedAccount ? selectedAccount.id : '-')}</p>
                        </div>
                    </div>
                </section>

                <section class="rb-card rb-card--actions">
                    <div class="rb-sectionHead">
                        <div>
                            <p class="rb-card__eyebrow">${escapeHtml(FALLBACK_STRINGS.quickActions)}</p>
                            <h3 class="rb-sectionHead__title">${escapeHtml('Self-Service Aktionen')}</h3>
                        </div>
                        <p class="rb-sectionHead__copy">${escapeHtml('Abheben, einzahlen oder direkt ueberweisen.')}</p>
                    </div>
                    ${renderQuickActions()}
                </section>

                <section class="rb-atmGrid">
                    <article class="rb-card">
                        <div class="rb-sectionHead">
                            <div>
                                <p class="rb-card__eyebrow">${escapeHtml(FALLBACK_STRINGS.keypad)}</p>
                                <h3 class="rb-sectionHead__title">${escapeHtml('Schnellbetraege')}</h3>
                            </div>
                            <p class="rb-sectionHead__copy">${escapeHtml('Waehle einen Betrag fuer eine direkte Abhebung.')}</p>
                        </div>
                        <div class="rb-atmKeypad">
                            ${presetAmounts.map((amount) => `
                                <button type="button" class="rb-key" data-action="preset-amount" data-value="${amount}">
                                    <span class="rb-key__main">${escapeHtml(formatMoney(amount))}</span>
                                    <span class="rb-key__sub">${escapeHtml('Direkt abheben')}</span>
                                </button>
                            `).join('')}
                        </div>
                    </article>

                    <article class="rb-card rb-card--ledger">
                        <div class="rb-sectionHead">
                            <div>
                                <p class="rb-card__eyebrow">${escapeHtml(FALLBACK_STRINGS.recentTransactions)}</p>
                                <h3 class="rb-sectionHead__title">${escapeHtml('Letzte ATM-relevante Buchungen')}</h3>
                            </div>
                            <p class="rb-sectionHead__copy">${escapeHtml(selectedAccount ? selectedAccount.id : '')}</p>
                        </div>
                        <div class="rb-list">
                            ${txs.length ? txs.map((tx) => {
                                const isIn = (tx.trans_type || '').toLowerCase() === 'deposit';
                                return `
                                    <article class="rb-rowCard">
                                        <div class="rb-rowCard__icon ${isIn ? 'is-in' : 'is-out'}">${isIn ? '+' : '-'}</div>
                                        <div>
                                            <p class="rb-rowCard__title">${escapeHtml(tx.message || tx.title || '-')}</p>
                                            <p class="rb-rowCard__sub">${escapeHtml(tx.receiver || tx.issuer || '-')}</p>
                                            <p class="rb-rowCard__sub">${escapeHtml(formatDate(tx.time))}</p>
                                        </div>
                                        <div>${txAmountCell(tx)}</div>
                                    </article>
                                `;
                            }).join('') : `
                                <div class="rb-empty rb-empty--compact">
                                    <p class="rb-empty__title">${escapeHtml(FALLBACK_STRINGS.noTransactions)}</p>
                                </div>
                            `}
                        </div>
                    </article>
                </section>
            </div>
        `;
    }

    function renderMainContent(selectedAccount) {
        if (state.atm) return renderAtmTab(selectedAccount);
        if (state.activeTab === 'transactions') return renderTransactions();
        return renderOverview(selectedAccount);
    }

    function renderTabs() {
        const tabs = state.atm
            ? [{ id: 'atm', label: FALLBACK_STRINGS.atm }]
            : [
                { id: 'overview', label: FALLBACK_STRINGS.dashboard },
                { id: 'transactions', label: FALLBACK_STRINGS.transactionLog }
            ];

        return tabs.map((tab) => `
            <button type="button" class="rb-tab ${state.activeTab === tab.id ? 'is-active' : ''}" data-action="switch-tab" data-tab="${tab.id}">${escapeHtml(tab.label)}</button>
        `).join('');
    }

    function renderMain(selectedAccount) {
        return `
            <section class="rb-main">
                <div class="rb-workspaceHead">
                    <div>
                        <p class="rb-workspaceHead__eyebrow">${escapeHtml(state.atm ? FALLBACK_STRINGS.modeAtm : FALLBACK_STRINGS.homebanking)}</p>
                        <h2 class="rb-workspaceHead__title">${escapeHtml(state.atm ? 'ATM Self-Service' : 'Ihre Bankzentrale')}</h2>
                    </div>
                    <div class="rb-tabs">${renderTabs()}</div>
                </div>
                <div class="rb-mainScroll">${renderMainContent(selectedAccount)}</div>
            </section>
        `;
    }

    function renderModal() {
        if (!state.modal) return '';
        const selected = getSelectedAccount();
        if (!selected) return '';

        const modalType = state.modal.type;
        const titleMap = {
            deposit: t('deposit_but', FALLBACK_STRINGS.actionDeposit),
            withdraw: t('withdraw_but', FALLBACK_STRINGS.actionWithdraw),
            transfer: t('transfer_but', FALLBACK_STRINGS.actionTransfer)
        };
        const helperMap = {
            deposit: 'Bargeld auf das gewaehlte Konto buchen.',
            withdraw: 'Betrag vom Konto abheben und als Bargeld erhalten.',
            transfer: 'Ueberweisung an eine Konto-ID oder CitizenID senden.'
        };
        const needsStateId = modalType === 'transfer';
        const presetAmount = Number(state.modal.presetAmount) || '';

        return `
            <div class="rb-modal is-open" role="dialog" aria-modal="true" aria-labelledby="rb-modal-title">
                <div class="rb-modal__backdrop" data-action="close-modal"></div>
                <section class="rb-modal__dialog">
                    <header class="rb-modal__header">
                        <div>
                            <p class="rb-card__eyebrow">${escapeHtml('Banking Aktion')}</p>
                            <h3 class="rb-modal__title" id="rb-modal-title">${escapeHtml(titleMap[modalType] || 'Aktion')}</h3>
                            <p class="rb-panel__subtitle">${escapeHtml(helperMap[modalType] || '')}</p>
                        </div>
                        <button type="button" class="rb-iconBtn" data-action="close-modal" aria-label="${escapeHtml(FALLBACK_STRINGS.close)}">✕</button>
                    </header>
                    <div class="rb-modal__body">
                        <div class="rb-modalAccount">
                            <span>${escapeHtml(FALLBACK_STRINGS.accountLabel)}</span>
                            <strong>${escapeHtml(selected.name || selected.id)}</strong>
                            <p>${escapeHtml(selected.id)} · ${escapeHtml(accountMask(selected))}</p>
                        </div>
                        <form class="rb-form" data-action="submit-form" data-action-type="${escapeHtml(modalType)}">
                            <div class="rb-field">
                                <label class="rb-label" for="rb-account-read">${escapeHtml(FALLBACK_STRINGS.accountLabel)}</label>
                                <input class="rb-input" id="rb-account-read" type="text" value="${escapeHtml((selected.name || selected.id) + ' (' + selected.id + ')')}" readonly />
                            </div>
                            <div class="rb-field">
                                <label class="rb-label" for="rb-amount">${escapeHtml(t('amount', FALLBACK_STRINGS.amountLabel))}</label>
                                <input class="rb-input" id="rb-amount" name="amount" type="number" min="1" step="1" placeholder="${escapeHtml(FALLBACK_STRINGS.amountPlaceholder)}" value="${escapeHtml(presetAmount)}" required />
                            </div>
                            ${needsStateId ? `
                                <div class="rb-field">
                                    <label class="rb-label" for="rb-stateid">${escapeHtml(t('transfer', FALLBACK_STRINGS.receiver))}</label>
                                    <input class="rb-input" id="rb-stateid" name="stateid" type="text" placeholder="${escapeHtml(FALLBACK_STRINGS.stateIdPlaceholder)}" required />
                                </div>
                            ` : ''}
                            <div class="rb-field">
                                <label class="rb-label" for="rb-comment">${escapeHtml(t('comment', FALLBACK_STRINGS.commentLabel))}</label>
                                <textarea class="rb-textarea" id="rb-comment" name="comment" placeholder="${escapeHtml(FALLBACK_STRINGS.commentPlaceholder)}"></textarea>
                            </div>
                            <div class="rb-form__actions">
                                <button type="button" class="rb-btn rb-btn--ghost" data-action="close-modal">${escapeHtml(t('cancel', FALLBACK_STRINGS.close))}</button>
                                <button type="submit" class="rb-btn rb-btn--primary">${escapeHtml(t('confirm', FALLBACK_STRINGS.submit))}</button>
                            </div>
                        </form>
                    </div>
                </section>
            </div>
        `;
    }

    function renderToast() {
        if (!state.toast) return '';
        return `
            <div class="rb-toastWrap">
                <div class="rb-toast" role="status" aria-live="polite">
                    <div class="rb-toast__icon">i</div>
                    <div>
                        <p class="rb-toast__title">${escapeHtml(state.theme && state.theme.contextLabel ? state.theme.contextLabel : 'Banking')}</p>
                        <p class="rb-toast__body">${escapeHtml(state.toast)}</p>
                    </div>
                </div>
            </div>
        `;
    }

    function renderLoading() {
        return `
            <div class="rb-loading ${state.loading ? 'is-visible' : ''}" aria-hidden="${state.loading ? 'false' : 'true'}">
                <div class="rb-loading__card">
                    <p class="rb-modal__title">${escapeHtml(FALLBACK_STRINGS.loading)}</p>
                    <div class="rb-loader"></div>
                    <p class="rb-panel__subtitle">${escapeHtml('Konten, Buchungen und Anzeige werden synchronisiert...')}</p>
                </div>
            </div>
        `;
    }

    function render() {
        const selectedAccount = getSelectedAccount();
        const theme = state.theme || DEFAULT_THEME;
        const modeLabel = state.atm ? (theme.contextLabel || FALLBACK_STRINGS.modeAtm) : (theme.contextLabel || FALLBACK_STRINGS.modeBank);
        const logoVisible = !!(theme.logo && String(theme.logo).trim());
        const logoSrc = logoVisible ? String(theme.logo) : '';
        const logoFallback = ((theme.name || 'BANK').replace(/[^A-Za-z0-9]/g, '').slice(0, 3) || 'BNK').toUpperCase();

        root.innerHTML = `
            <div class="rb-shell ${state.visible ? 'is-visible' : ''}" aria-hidden="${state.visible ? 'false' : 'true'}">
                <div class="rb-backdrop"></div>
                <div class="rb-app" role="application" aria-label="Banking UI">
                    <header class="rb-topbar">
                        <div class="rb-brand">
                            <div class="rb-brand__logoWrap" aria-hidden="true">
                                <img class="rb-brand__logo ${logoVisible ? 'is-visible' : ''}" src="${escapeHtml(logoSrc)}" alt="" />
                                <div class="rb-brand__logoFallback ${logoVisible ? 'rb-hidden' : ''}">${escapeHtml(logoFallback)}</div>
                            </div>
                            <div class="rb-brand__meta">
                                <p class="rb-brand__eyebrow">${escapeHtml(modeLabel)}</p>
                                <h1 class="rb-brand__name">${escapeHtml(theme.name || t('bank_name', 'Los Santos Banking'))}</h1>
                                <p class="rb-brand__sub">${escapeHtml(theme.subtitle || FALLBACK_STRINGS.homebanking)}${theme.location ? ' · ' + escapeHtml(theme.location) : ''}</p>
                            </div>
                        </div>
                        <div class="rb-topbar__meta">
                            <div class="rb-chip">
                                <span class="rb-chip__dot"></span>
                                <span>${escapeHtml(state.atm ? FALLBACK_STRINGS.modeAtm : FALLBACK_STRINGS.modeBank)}</span>
                            </div>
                            <div class="rb-topbar__actions">
                                ${!state.atm ? `<button class="rb-btn rb-btn--ghost" type="button" data-action="switch-tab" data-tab="overview">${escapeHtml(FALLBACK_STRINGS.dashboard)}</button>` : ''}
                                <button class="rb-btn rb-btn--primary" type="button" data-action="close-ui">${escapeHtml(t('close', FALLBACK_STRINGS.close))}</button>
                            </div>
                        </div>
                    </header>

                    <div class="rb-layout ${state.atm ? 'is-atm' : ''}">
                        ${state.atm ? '' : renderSidebar(selectedAccount)}
                        ${renderMain(selectedAccount)}
                    </div>
                </div>
            </div>
            ${renderModal()}
            ${renderToast()}
            ${renderLoading()}
        `;
    }

    function showToast(message) {
        state.toast = typeof message === 'string' ? message : String(message || '');
        render();
        if (showToast._timer) clearTimeout(showToast._timer);
        showToast._timer = setTimeout(() => {
            state.toast = '';
            render();
        }, 3500);
    }

    function ensureSelection() {
        if (!state.accounts.length) {
            state.selectedAccountId = null;
            return;
        }
        if (!state.accounts.some((entry) => entry.id === state.selectedAccountId)) {
            state.selectedAccountId = state.accounts[0].id;
        }
    }

    function handleSetVisible(payload) {
        state.visible = !!payload.status;
        state.loading = !!payload.loading;
        state.atm = !!payload.atm;
        state.accounts = normalizeAccounts(payload.accounts);
        state.activeTab = state.atm ? 'atm' : (state.activeTab === 'transactions' ? 'transactions' : 'overview');
        applyTheme(payload.theme || null);
        ensureSelection();
        render();
    }

    function handleMessage(raw) {
        const msg = raw && raw.data && raw.data.action ? raw.data : raw;
        if (!msg || !msg.action) return;

        switch (msg.action) {
            case 'setVisible':
                handleSetVisible(msg);
                break;
            case 'setLoading':
                state.loading = !!msg.status;
                render();
                break;
            case 'notify':
                showToast(msg.status || '');
                break;
            case 'updateLocale':
                state.locale = (msg.translations && typeof msg.translations === 'object') ? msg.translations : {};
                state.currency = typeof msg.currency === 'string' ? msg.currency : state.currency;
                render();
                break;
            default:
                break;
        }
    }

    window.addEventListener('message', (event) => handleMessage(event.data));

    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        if (state.modal) {
            closeActionModal();
            return;
        }
        if (state.visible) {
            closeUi();
        }
    });

    root.addEventListener('click', (event) => {
        const target = event.target.closest('[data-action]');
        if (!target) return;

        const action = target.dataset.action;
        if (action === 'close-ui') {
            closeUi();
            return;
        }

        if (action === 'close-modal') {
            closeActionModal();
            return;
        }

        if (action === 'switch-tab') {
            const tab = target.dataset.tab;
            if (tab) {
                state.activeTab = tab;
                render();
            }
            return;
        }

        if (action === 'select-account') {
            const accountId = target.dataset.accountId;
            if (accountId) setSelectedAccount(accountId);
            return;
        }

        if (action === 'open-modal') {
            const type = target.dataset.modalType;
            if (type) openActionModal(type);
            return;
        }

        if (action === 'preset-amount') {
            const value = Number(target.dataset.value);
            state.modal = { type: 'withdraw', presetAmount: Number.isFinite(value) ? value : '' };
            render();
            return;
        }
    });

    root.addEventListener('input', (event) => {
        const target = event.target;
        if (!target) return;

        if (target.matches('[data-action="search-tx"]')) {
            state.txSearch = target.value || '';
            render();
        }
    });

    root.addEventListener('submit', (event) => {
        const form = event.target;
        if (!(form instanceof HTMLFormElement)) return;
        if (form.dataset.action !== 'submit-form') return;
        event.preventDefault();
        submitActionForm(form);
    });

    function bootPreview() {
        if (typeof window.invokeNative !== 'undefined') return;
        if (state.previewBooted) return;
        state.previewBooted = true;

        setTimeout(() => {
            handleMessage({
                action: 'updateLocale',
                translations: {
                    ...FALLBACK_STRINGS,
                    bank_name: 'Los Santos Banking',
                    deposit_but: 'Deposit',
                    withdraw_but: 'Withdraw',
                    transfer_but: 'Transfer',
                    amount: 'Amount',
                    comment: 'Comment',
                    confirm: 'Submit',
                    cancel: 'Cancel',
                    transfer: 'Business or Citizen ID',
                    trans_search: 'Transaction Search (Message, TransID, Receiver)...'
                },
                currency: 'USD'
            });

            handleMessage({
                action: 'setVisible',
                status: true,
                loading: false,
                atm: false,
                theme: {
                    key: 'FLEECA',
                    name: 'FLEECA BANK',
                    subtitle: 'Premium Homebanking',
                    contextLabel: 'Bank',
                    location: 'Alta Street / Downtown',
                    logo: './img/banks/fleeca-logo.png',
                    colors: {
                        accent: '#4ade80',
                        accent2: '#16a34a',
                        accentContrast: '#f0fdf4',
                        glow: 'rgba(74, 222, 128, 0.30)',
                        flowRingOut: 'rgba(251, 113, 133, 0.28)'
                    }
                },
                accounts: [
                    {
                        id: 'CID-1007',
                        type: 'Personal',
                        name: 'Frank Hildebrandt',
                        frozen: 0,
                        amount: 126420,
                        cash: 1840,
                        transactions: [
                            { trans_id: 'tx-1', title: 'Personal Account / CID-1007', amount: 2500, trans_type: 'deposit', receiver: 'FLEECA', message: 'Salary payout', issuer: 'Maze Bank Payroll', time: Math.floor(Date.now() / 1000) - 3000 },
                            { trans_id: 'tx-2', title: 'Personal Account / CID-1007', amount: 480, trans_type: 'withdraw', receiver: 'Downtown ATM', message: 'Cash withdrawal', issuer: 'Frank', time: Math.floor(Date.now() / 1000) - 8600 },
                            { trans_id: 'tx-3', title: 'Personal Account / CID-1007', amount: 12000, trans_type: 'deposit', receiver: 'FLEECA', message: 'Business transfer', issuer: 'KRGSH GmbH', time: Math.floor(Date.now() / 1000) - 26000 }
                        ]
                    },
                    {
                        id: 'krgsh_main',
                        type: 'Organization',
                        name: 'KRGSH Banking Ops',
                        frozen: 0,
                        amount: 945000,
                        transactions: [
                            { trans_id: 'tx-4', title: 'KRGSH Banking Ops / krgsh_main', amount: 50000, trans_type: 'withdraw', receiver: 'Vendor', message: 'Operations payout', issuer: 'KRGSH', time: Math.floor(Date.now() / 1000) - 7000 },
                            { trans_id: 'tx-5', title: 'KRGSH Banking Ops / krgsh_main', amount: 80000, trans_type: 'deposit', receiver: 'Invoice', message: 'Client payment', issuer: 'LS Customs', time: Math.floor(Date.now() / 1000) - 17000 }
                        ]
                    }
                ]
            });
        }, 120);
    }

    applyTheme(DEFAULT_THEME);
    render();
    bootPreview();
})();
