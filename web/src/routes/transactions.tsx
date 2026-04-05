import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Box, Tabs, rem } from '@mantine/core';

import { useAccounts } from '../hooks/useAccounts';
import { useLocale } from '../hooks/useLocale';
import { useBankingStore } from '../store/bankingStore';

import TransactionTable from '../components/Transactions/TransactionTable';

export const Route = createFileRoute('/transactions')({
  component: TransactionsPage,
});

function TransactionsPage() {
  const { data: accounts = [] } = useAccounts();
  const selectedAccountId = useBankingStore((s) => s.selectedAccountId);
  const atm = useBankingStore((s) => s.atm);
  const selectedAccount =
    accounts.find((a) => a.id === selectedAccountId) ?? accounts[0] ?? null;
  const { t } = useLocale();
  const navigate = useNavigate();

  return (
    <Box
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Box
        style={{
          flexShrink: 0,
          paddingLeft: rem(24),
          paddingRight: rem(24),
          paddingTop: rem(24),
        }}
      >
        <Tabs
          value="transactions"
          onChange={(v) => {
            if (v === 'overview') void navigate({ to: '/overview' });
            if (v === 'schedules') void navigate({ to: '/schedules' });
          }}
          mb={rem(20)}
          styles={{
            tab: {
              color: 'var(--rb-text-muted)',
              '&[data-active]': {
                color: 'var(--rb-accent)',
                borderBottomColor: 'var(--rb-accent)',
              },
            },
            list: { borderBottomColor: 'var(--rb-border)' },
          }}
        >
          <Tabs.List>
            <Tabs.Tab value="overview">{t('dashboard', 'Kontouebersicht')}</Tabs.Tab>
            <Tabs.Tab value="transactions">{t('transactionLog', 'Buchungen')}</Tabs.Tab>
            {!atm ? <Tabs.Tab value="schedules">{t('pi_nav', 'Zahlungsplaene')}</Tabs.Tab> : null}
          </Tabs.List>
        </Tabs>
      </Box>

      <Box
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          paddingLeft: rem(24),
          paddingRight: rem(24),
          paddingBottom: rem(24),
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <TransactionTable account={selectedAccount} allAccounts={accounts} t={t} />
      </Box>
    </Box>
  );
}
