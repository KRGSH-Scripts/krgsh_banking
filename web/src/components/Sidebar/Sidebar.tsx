import { Stack, Box, Text, Group, Divider, rem } from '@mantine/core';
import type { Account } from '../../types';
import { useBankingStore } from '../../store/bankingStore';
import {
  formatMoney,
  sumAccountBalances,
  getCashBalance,
  latestTransaction,
  relativeTime,
} from '../../lib/formatters';
import AccountCard from './AccountCard';

interface SidebarProps {
  accounts: Account[];
  selectedAccount: Account | null;
  t: (key: string, fallback?: string) => string;
}

export default function Sidebar({ accounts, selectedAccount, t }: SidebarProps) {
  const currency = useBankingStore((s) => s.currency);
  const locale = useBankingStore((s) => s.locale);
  const setSelectedAccountId = useBankingStore((s) => s.setSelectedAccountId);
  const selectedAccountId = useBankingStore((s) => s.selectedAccountId);

  const totalBalance = sumAccountBalances(accounts);
  const cashBalance = getCashBalance(accounts);
  const latest = latestTransaction(accounts);

  const fmt = (v: number) => formatMoney(v, currency);

  return (
    <Stack gap={0} style={{ height: '100%' }}>
      {/* Header block */}
      <Box
        p={rem(20)}
        style={{ borderBottom: '1px solid var(--rb-border)' }}
      >
        <Text size="xs" c="dimmed" tt="uppercase" fw={600} lts={1} mb={rem(4)}>
          {t('portfolio', 'Konten')}
        </Text>

        <Group gap={rem(20)} mt={rem(12)}>
          <Box>
            <Text size="xs" style={{ color: 'var(--rb-text-muted)' }}>
              {t('totalBalance', 'Gesamtguthaben')}
            </Text>
            <Text
              fw={700}
              style={{
                color: 'var(--rb-accent)',
                fontFamily: 'var(--mantine-font-family-headings)',
                fontSize: rem(18),
              }}
            >
              {fmt(totalBalance)}
            </Text>
          </Box>
          <Box>
            <Text size="xs" style={{ color: 'var(--rb-text-muted)' }}>
              {t('cash', 'Bargeld')}
            </Text>
            <Text fw={600} style={{ color: 'var(--rb-inflow)', fontSize: rem(15) }}>
              {fmt(cashBalance)}
            </Text>
          </Box>
        </Group>
      </Box>

      {/* Selected account info */}
      {selectedAccount && (
        <Box
          p={rem(16)}
          style={{ borderBottom: '1px solid var(--rb-border)', background: 'var(--rb-surface)' }}
        >
          <Text size="xs" c="dimmed" tt="uppercase" fw={600} lts={1} mb={rem(4)}>
            {t('selectedAccount', 'Aktives Konto')}
          </Text>
          <Text fw={600} size="sm" style={{ color: 'var(--rb-text)' }}>
            {selectedAccount.name || selectedAccount.id}
          </Text>
          <Text size="xs" style={{ color: 'var(--rb-text-muted)' }}>
            {latest
              ? `Letzte Aktivität ${relativeTime(latest.time, locale)}`
              : t('noTransactions', 'Keine Buchungen')}
          </Text>
        </Box>
      )}

      <Divider color="var(--rb-divider)" />

      {/* Account count */}
      <Box px={rem(20)} pt={rem(16)} pb={rem(8)}>
        <Group justify="space-between">
          <Text size="xs" c="dimmed" tt="uppercase" fw={600} lts={1}>
            {t('accountCount', 'Konten')} ({accounts.length})
          </Text>
          <Text size="xs" style={{ color: 'var(--rb-text-muted)' }}>
            {t('select_account', 'Konto wählen')}
          </Text>
        </Group>
      </Box>

      {/* Account list */}
      <Stack gap={rem(8)} px={rem(12)} pb={rem(12)} style={{ flex: 1, overflowY: 'auto' }}>
        {accounts.length === 0 ? (
          <Box p={rem(16)} ta="center">
            <Text size="sm" style={{ color: 'var(--rb-text-muted)' }}>
              {t('noAccounts', 'Keine Konten vorhanden')}
            </Text>
          </Box>
        ) : (
          accounts.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              selected={account.id === selectedAccountId}
              onClick={() => setSelectedAccountId(account.id)}
              t={t}
              currency={currency}
              locale={locale}
            />
          ))
        )}
      </Stack>
    </Stack>
  );
}
