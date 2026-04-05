import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Stack, Tabs, rem } from '@mantine/core';

import { useAccounts } from '../hooks/useAccounts';
import { useLocale } from '../hooks/useLocale';

import TransactionTable from '../components/Transactions/TransactionTable';

export const Route = createFileRoute('/transactions')({
  component: TransactionsPage,
});

function TransactionsPage() {
  const { data: accounts = [] } = useAccounts();
  const { t } = useLocale();
  const navigate = useNavigate();

  return (
    <Stack gap={0} p={rem(24)} style={{ minHeight: '100%' }}>
      {/* Tab bar */}
      <Tabs
        value="transactions"
        onChange={(v) => {
          if (v === 'overview') void navigate({ to: '/overview' });
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
        </Tabs.List>
      </Tabs>

      <TransactionTable accounts={accounts} t={t} />
    </Stack>
  );
}
