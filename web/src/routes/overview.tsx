import { createFileRoute } from '@tanstack/react-router';
import { Box, Tabs, Transition, rem } from '@mantine/core';
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
          value="overview"
          onChange={(v) => {
            if (v === 'transactions') void navigate({ to: '/transactions' });
            if (v === 'schedules') void navigate({ to: '/schedules' });
            if (v === 'bank-cards') void navigate({ to: '/bank-cards' });
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
            {!atm ? <Tabs.Tab value="bank-cards">{t('bank_cards_nav', 'Karten')}</Tabs.Tab> : null}
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
        <Transition
          key={selectedAccount?.id ?? 'none'}
          mounted
          transition="fade"
          duration={220}
          timingFunction="cubic-bezier(0.4, 0, 0.2, 1)"
        >
          {(fadeStyles) => (
            <Box
              component="div"
              style={{ ...fadeStyles, display: 'flex', flexDirection: 'column', gap: rem(20) }}
            >
              <HeroSection account={selectedAccount} accounts={accounts} t={t} />
              <QuickActions selectedAccount={selectedAccount} t={t} />
              <KpiGrid accounts={accounts} selectedAccount={selectedAccount} t={t} />
              <AnalyticsChart account={selectedAccount} t={t} />
              <RecentActivity account={selectedAccount} allAccounts={accounts} t={t} />
            </Box>
          )}
        </Transition>
      </Box>
    </Box>
  );
}
