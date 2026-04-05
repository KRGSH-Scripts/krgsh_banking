// ─── Domain Types ─────────────────────────────────────────────────────────────

export interface Transaction {
  trans_id: string;
  title: string;
  amount: number;
  /** Server uses deposit/withdraw; other values possible via exports. */
  trans_type: string;
  receiver: string;
  message: string;
  issuer: string;
  time: number;
  // Injected client-side when merging all accounts' transactions
  __accountId?: string;
  __accountName?: string;
}

export interface Account {
  id: string;
  type: string;
  name: string;
  /** Display number (matches personal CitizenID length for org accounts when set by server). */
  accountNumber?: string;
  frozen: number | boolean;
  amount: number;
  cash?: number; // Only present on the personal account
  transactions: Transaction[];
  auth?: Record<string, true>;
  creator?: string | null;
}

// ─── Theme ────────────────────────────────────────────────────────────────────

export interface ThemeColors {
  bg: string;
  bg2: string;
  surface: string;
  surface2: string;
  card: string;
  border: string;
  text: string;
  textMuted: string;
  textSoft: string;
  accent: string;
  accent2: string;
  accentContrast: string;
  glow: string;
  danger: string;
  warning: string;
  flowRingOut: string;
}

export interface BankTheme {
  key: string;
  name: string;
  subtitle: string;
  contextLabel: string;
  location: string;
  logo: string;
  colors: ThemeColors;
}

// ─── UI State ─────────────────────────────────────────────────────────────────

export type ModalType = 'deposit' | 'withdraw' | 'transfer';

export interface ModalState {
  type: ModalType;
  presetAmount?: number;
}

// ─── NUI Message Payloads ─────────────────────────────────────────────────────

export interface SetVisiblePayload {
  action: 'setVisible';
  status: boolean;
  accounts: Account[];
  loading: boolean;
  atm: boolean;
  canCreateAccounts?: boolean;
  theme?: Partial<BankTheme>;
}

export interface SetLoadingPayload {
  action: 'setLoading';
  status: boolean;
}

export interface NotifyPayload {
  action: 'notify';
  status: string;
}

export interface UpdateLocalePayload {
  action: 'updateLocale';
  translations: Record<string, string>;
  currency: string;
}

export type NuiMessage =
  | SetVisiblePayload
  | SetLoadingPayload
  | NotifyPayload
  | UpdateLocalePayload;

// ─── NUI Callback Payloads ────────────────────────────────────────────────────

export interface TransactionPayload {
  fromAccount: string;
  amount: number;
  comment: string;
  stateid?: string;
}
