import { createFileRoute } from '@tanstack/react-router';
import { Stack, Tabs, Transition, rem } from '@mantine/core';
import { useNavigate } from '@tanstack/react-router';

import { useAccounts } from '../hooks/useAccounts';
import { useLocale } from '../hooks/useLocale';
import { useBankingStore } from '../store/bankingStore';

import HeroSection from '../components/Overview/HeroSection';
import QuickActions from '../components/Overview/QuickActions';
import KpiGrid from '../components/Overview/KpiGrid';
import AnalyticsChart from '../components/Overview/AnalyticsChart';
import RecentActivity from '../components/Overview/RecentActivity';

export const Route = createFileRoute('/overview')({
  component: OverviewPage,
});

function OverviewPage() {
  const { data: accounts = [] } = useAccounts();
  const selectedAccountId = useBankingStore((s) => s.selectedAccountId);
  const selectedAccount =
    accounts.find((a) => a.id === selectedAccountId) ?? accounts[0] ?? null;
  const { t } = useLocale();
  const navigate = useNavigate();

  return (
    <Stack gap={0} p={rem(24)} style={{ minHeight: '100%' }}>
      {/* Tab bar */}
      <Tabs
        value="overview"
        onChange={(v) => {
          if (v === 'transactions') void navigate({ to: '/transactions' });
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

      <Transition
        key={selectedAccount?.id ?? 'none'}
        mounted
        transition="fade"
        duration={220}
        timingFunction="cubic-bezier(0.4, 0, 0.2, 1)"
      >
        {(fadeStyles) => (
          <Stack gap={rem(20)} style={fadeStyles}>
            <HeroSection account={selectedAccount} accounts={accounts} t={t} />
            <QuickActions selectedAccount={selectedAccount} t={t} />
            <KpiGrid accounts={accounts} t={t} />
            <AnalyticsChart account={selectedAccount} t={t} />
            <RecentActivity account={selectedAccount} t={t} />
          </Stack>
        )}
      </Transition>
    </Stack>
  );
}
