import { createFileRoute } from '@tanstack/react-router';
import { Stack, rem } from '@mantine/core';

import { useAccounts } from '../hooks/useAccounts';
import { useLocale } from '../hooks/useLocale';
import { useBankingStore } from '../store/bankingStore';

import AtmHero from '../components/ATM/AtmHero';
import AtmKeypad from '../components/ATM/AtmKeypad';
import AtmRecent from '../components/ATM/AtmRecent';
import QuickActions from '../components/Overview/QuickActions';

export const Route = createFileRoute('/atm')({
  component: AtmPage,
});

function AtmPage() {
  const { data: accounts = [] } = useAccounts();
  const selectedAccountId = useBankingStore((s) => s.selectedAccountId);
  const selectedAccount =
    accounts.find((a) => a.id === selectedAccountId) ?? accounts[0] ?? null;
  const { t } = useLocale();

  return (
    <Stack gap={rem(20)} p={rem(24)} style={{ minHeight: '100%' }}>
      <AtmHero account={selectedAccount} t={t} />
      <QuickActions selectedAccount={selectedAccount} t={t} />
      <AtmKeypad selectedAccount={selectedAccount} t={t} />
      <AtmRecent account={selectedAccount} t={t} />
    </Stack>
  );
}
