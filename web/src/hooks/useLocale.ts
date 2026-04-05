import { useBankingStore } from '../store/bankingStore';

const FALLBACK: Record<string, string> = {
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
  receiver: 'Empfaenger / Konto',
  date: 'Zeit',
  accountLabel: 'Konto',
  amountLabel: 'Betrag',
  commentLabel: 'Verwendungszweck',
  messageLabel: 'Buchung',
  actorLabel: 'Beteiligte',
  typeLabel: 'Typ',
  submit: 'Bestaetigen',
  close: 'Schliessen',
  homebanking: 'Homebanking',
  modeBank: 'Bank',
  modeAtm: 'Geldautomat',
  noAccounts: 'Keine Konten vorhanden',
  loading: 'Kontodaten werden geladen...',
  actionDeposit: 'Einzahlen',
  actionWithdraw: 'Abheben',
  actionTransfer: 'Ueberweisen',
  actionModalHint: 'Aktionen werden weiterhin serverseitig geprueft.',
  amountPlaceholder: '0',
  commentPlaceholder: 'Optionaler Verwendungszweck',
  stateIdPlaceholder: 'CitizenID / Konto-ID',
  deposit_but: 'Einzahlen',
  withdraw_but: 'Abheben',
  transfer_but: 'Ueberweisen',
  bank_name: 'Los Santos Banking',
  frozen: 'Gesperrt',
  available: 'Aktiv',
  available_balance: 'Verfuegbarer Kontostand',
  keypad: 'Schnellbetraege',
  atmTerminal: 'Self-Service',
  customTransfer: 'Individuelle Buchung',
  trans_not_found: 'Keine Buchungen gefunden',
  trans_search: 'Buchung suchen...',
  cancel: 'Abbrechen',
  confirm: 'Bestaetigen',
  transfer: 'Business oder CitizenID',
};

export function useLocale() {
  const locale = useBankingStore((s) => s.locale);

  function t(key: string, fallback?: string): string {
    const value = locale[key];
    if (typeof value === 'string' && value.length > 0) return value;
    return fallback ?? FALLBACK[key] ?? key;
  }

  return { t, locale };
}
