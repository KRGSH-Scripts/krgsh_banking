import {
  useQuery,
  useMutation,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import {
  postNui,
  normalizeAccounts,
  normalizeAtmCards,
  isAtmBankPayload,
} from '../lib/nui';
import { useBankingStore } from '../store/bankingStore';
import type { Account, TransactionPayload } from '../types';

/** Apply deposit/withdraw/transfer or verifyBankCardPin server payload to React Query + ATM card list. */
export function applyBankingServerPayload(
  queryClient: QueryClient,
  data: unknown,
): void {
  if (data === false || data == null) return;
  const store = useBankingStore.getState();
  if (isAtmBankPayload(data)) {
    const accounts = normalizeAccounts(data.accounts);
    queryClient.setQueryData(['accounts'], accounts);
    store.setAtmCards(normalizeAtmCards(data.atmCards));
    const currentId = store.selectedAccountId;
    if (!accounts.some((a) => a.id === currentId)) {
      store.setSelectedAccountId(accounts[0]?.id ?? null);
    }
    return;
  }
  if (Array.isArray(data)) {
    const accounts = normalizeAccounts(data);
    queryClient.setQueryData(['accounts'], accounts);
    const currentId = store.selectedAccountId;
    if (!accounts.some((a) => a.id === currentId)) {
      store.setSelectedAccountId(accounts[0]?.id ?? null);
    }
  }
}

export function useAccounts() {
  return useQuery<Account[]>({
    queryKey: ['accounts'],
    queryFn: () => [],
    initialData: [],
    staleTime: Infinity, // Data is pushed from server, not fetched
  });
}

function useTransactionMutation(action: 'deposit' | 'withdraw' | 'transfer') {
  const queryClient = useQueryClient();
  const store = useBankingStore();

  return useMutation({
    mutationFn: (payload: TransactionPayload) => {
      const out: Record<string, unknown> = { ...payload };
      if (useBankingStore.getState().atm) {
        out.atm = true;
        const accounts = queryClient.getQueryData<Account[]>(['accounts']) ?? [];
        const acc = accounts.find((a) => a.id === payload.fromAccount);
        if (acc?.bankCardId) out.bankCardId = acc.bankCardId;
      }
      return postNui<unknown>(action, out);
    },
    onMutate: () => {
      store.setLoading(true);
    },
    onSettled: () => {
      store.setLoading(false);
    },
    onSuccess: (data) => {
      applyBankingServerPayload(queryClient, data);
      store.closeModal();
    },
  });
}

export function useDeposit() {
  return useTransactionMutation('deposit');
}

export function useWithdraw() {
  return useTransactionMutation('withdraw');
}

export function useTransfer() {
  return useTransactionMutation('transfer');
}

export function useCreateAccount() {
  const queryClient = useQueryClient();
  const store = useBankingStore();

  return useMutation({
    mutationFn: (displayName: string) =>
      postNui<Account[]>('createAccount', { displayName }),
    onMutate: () => {
      store.setLoading(true);
    },
    onSettled: () => {
      store.setLoading(false);
    },
    onSuccess: (data) => {
      if (data !== false && Array.isArray(data)) {
        const accounts = normalizeAccounts(data);
        queryClient.setQueryData(['accounts'], accounts);
        const last = accounts[accounts.length - 1];
        if (last) store.setSelectedAccountId(last.id);
      }
    },
  });
}
