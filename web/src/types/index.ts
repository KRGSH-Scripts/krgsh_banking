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
  /** Physical bank card used at ATM (shared accounts, `atmCardsOnly` mode). */
  bankCardId?: string;
  /** Player may order a bank card for this account (personal or owned shared). */
  canIssueCard?: boolean;
}

/** Row from `listBankCards` (inventory + registry). */
export interface InventoryBankCardRow {
  slot: string | number;
  accountId: string;
  cardId: string;
  label: string;
  accountName: string;
  kind: 'personal' | 'shared';
  hasPin: boolean;
  bank: string;
}

/** One insertable bank card at the ATM (from server / inventory). */
export interface AtmCardOption {
  accountId: string;
  cardId: string;
  accountName: string;
  label: string;
  needsPin: boolean;
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
  atmCards?: AtmCardOption[];
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
  /** Set for ATM shared-account ops when `Config.atmCardsOnly` is enabled. */
  atm?: boolean;
  bankCardId?: string;
}

export type PaymentInstructionKind =
  | 'standing_order'
  | 'direct_debit'
  | 'installment'
  | 'subscription';

export type PaymentInstructionStatus =
  | 'pending_debtor_confirm'
  | 'active'
  | 'paused'
  | 'cancelled'
  | 'completed'
  | 'declined';

export interface PaymentInstruction {
  id: string;
  kind: PaymentInstructionKind;
  debtor_account_id: string;
  creditor_target: string;
  amount: number;
  interval_seconds: number;
  next_run_at: number;
  status: PaymentInstructionStatus;
  metadata: Record<string, unknown>;
  created_at: number;
  updated_at: number;
}
