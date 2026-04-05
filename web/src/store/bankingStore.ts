import { create } from 'zustand';
import type { AtmCardOption, BankTheme, ModalState } from '../types';
import { DEFAULT_THEME, mergeTheme, applyThemeCssVars } from '../lib/theme';

interface BankingState {
  visible: boolean;
  loading: boolean;
  atm: boolean;
  canCreateAccounts: boolean;
  selectedAccountId: string | null;
  atmCards: AtmCardOption[];
  locale: Record<string, string>;
  currency: string;
  theme: BankTheme;
  toast: string | null;
  modal: ModalState | null;

  // Actions
  setVisible: (
    visible: boolean,
    atm: boolean,
    theme?: Partial<BankTheme>,
    canCreateAccounts?: boolean,
    atmCards?: AtmCardOption[],
  ) => void;
  setLoading: (loading: boolean) => void;
  setSelectedAccountId: (id: string | null) => void;
  setAtmCards: (cards: AtmCardOption[]) => void;
  setLocale: (locale: Record<string, string>, currency: string) => void;
  showToast: (message: string) => void;
  hideToast: () => void;
  openModal: (modal: ModalState) => void;
  closeModal: () => void;
}

let toastTimer: ReturnType<typeof setTimeout> | null = null;

export const useBankingStore = create<BankingState>()((set, get) => ({
  visible: false,
  loading: false,
  atm: false,
  canCreateAccounts: false,
  selectedAccountId: null,
  atmCards: [],
  locale: {},
  currency: 'USD',
  theme: DEFAULT_THEME,
  toast: null,
  modal: null,

  setVisible: (visible, atm, incomingTheme, canCreateAccounts = false, atmCards) => {
    const resolved = incomingTheme
      ? mergeTheme(get().theme, incomingTheme)
      : get().theme;
    applyThemeCssVars(resolved);
    set({
      visible,
      atm,
      theme: resolved,
      modal: null,
      canCreateAccounts: !!canCreateAccounts,
      atmCards: atm ? (atmCards ?? []) : [],
    });
  },

  setLoading: (loading) => set({ loading }),

  setSelectedAccountId: (id) => set({ selectedAccountId: id }),

  setAtmCards: (atmCards) => set({ atmCards }),

  setLocale: (locale, currency) => set({ locale, currency }),

  showToast: (message) => {
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      set({ toast: null });
      toastTimer = null;
    }, 3500);
    set({ toast: message });
  },

  hideToast: () => {
    if (toastTimer) clearTimeout(toastTimer);
    set({ toast: null });
  },

  openModal: (modal) => set({ modal }),

  closeModal: () => set({ modal: null }),
}));
