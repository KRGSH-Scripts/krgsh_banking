import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useBankingStore } from '../store/bankingStore';
import { normalizeAccounts, normalizeAtmCards } from '../lib/nui';
import type { NuiMessage } from '../types';

export function useNuiMessage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const store = useBankingStore();

  useEffect(() => {
    function handler(event: MessageEvent<NuiMessage>) {
      const msg = event.data;
      if (!msg || !msg.action) return;

      switch (msg.action) {
        case 'setVisible': {
          const accounts = normalizeAccounts(msg.accounts ?? []);
          queryClient.setQueryData(['accounts'], accounts);

          // Ensure selectedAccountId is valid
          const currentId = useBankingStore.getState().selectedAccountId;
          if (!accounts.some((a) => a.id === currentId)) {
            store.setSelectedAccountId(accounts[0]?.id ?? null);
          }

          store.setVisible(
            !!msg.status,
            !!msg.atm,
            msg.theme,
            !!msg.canCreateAccounts,
            normalizeAtmCards(msg.atmCards),
          );
          store.setLoading(!!msg.loading);

          void navigate({ to: msg.atm ? '/atm' : '/overview' });
          break;
        }
        case 'setLoading':
          store.setLoading(!!msg.status);
          break;
        case 'notify':
          store.showToast(msg.status ?? '');
          break;
        case 'updateLocale':
          store.setLocale(
            typeof msg.translations === 'object' && msg.translations !== null
              ? (msg.translations as Record<string, string>)
              : {},
            typeof msg.currency === 'string' ? msg.currency : store.currency,
          );
          break;
      }
    }

    window.addEventListener('message', handler as EventListener);
    return () => window.removeEventListener('message', handler as EventListener);
  }, [queryClient, navigate, store]);
}
