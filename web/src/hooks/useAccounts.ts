import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { postNui, normalizeAccounts } from '../lib/nui';
import { useBankingStore } from '../store/bankingStore';
import type { Account, TransactionPayload } from '../types';

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
    mutationFn: (payload: TransactionPayload) =>
      postNui<Account[]>(action, payload as unknown as Record<string, unknown>),
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

        // Keep selection valid
        const currentId = store.selectedAccountId;
        if (!accounts.some((a) => a.id === currentId)) {
          store.setSelectedAccountId(accounts[0]?.id ?? null);
        }
      }
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
