import { SimpleGrid, Card, Text, rem } from '@mantine/core';
import type { Account } from '../../types';
import {
  formatMoney,
  formatDate,
  sumAccountBalances,
  getCashBalance,
} from '../../lib/formatters';
import { useBankingStore } from '../../store/bankingStore';

interface KpiGridProps {
  accounts: Account[];
  selectedAccount: Account | null;
  t: (key: string, fallback?: string) => string;
}

function latestTxForAccount(account: Account | null) {
  if (!account?.transactions?.length) return undefined;
  const sorted = [...account.transactions].sort(
    (a, b) => (Number(b.time) || 0) - (Number(a.time) || 0),
  );
  return sorted[0];
}

export default function KpiGrid({
  accounts,
  selectedAccount,
  t,
}: KpiGridProps) {
  const currency = useBankingStore((s) => s.currency);
  const latest = latestTxForAccount(selectedAccount);
  const fmt = (v: number) => formatMoney(v, currency);

  const stats = [
    {
      label: t('totalBalance', 'Gesamtguthaben'),
      value: fmt(sumAccountBalances(accounts)),
      meta: 'Alle verknüpften Konten',
    },
    {
      label: t('cash', 'Bargeld'),
      value: fmt(getCashBalance(accounts)),
      meta: 'Sofort verfügbar',
    },
    {
      label: t('accountCount', 'Konten'),
      value: String(accounts.length),
      meta: 'Freigeschaltete Konten',
    },
    {
      label: t('kpi_last_booking', 'Letzte Buchung'),
      value: latest ? formatDate(latest.time) : '-',
      meta: latest
        ? (latest.message || latest.title || 'Letzte Buchung')
        : t('noTransactions', 'Keine Buchungen'),
    },
  ];

  return (
    <SimpleGrid cols={{ base: 2, sm: 4 }} spacing={rem(12)}>
      {stats.map((stat) => (
        <Card
          key={stat.label}
          p={rem(16)}
          style={{
            background: 'var(--rb-card)',
            border: '1px solid var(--rb-border)',
            borderRadius: rem(14),
          }}
        >
          <Text size="xs" style={{ color: 'var(--rb-text-muted)' }} tt="uppercase" fw={600} lts={0.5}>
            {stat.label}
          </Text>
          <Text
            fw={700}
            mt={rem(4)}
            style={{
              color: 'var(--rb-text)',
              fontFamily: 'var(--mantine-font-family-headings)',
              fontSize: rem(18),
            }}
          >
            {stat.value}
          </Text>
          <Text size="xs" mt={rem(2)} style={{ color: 'var(--rb-text-soft)' }} truncate>
            {stat.meta}
          </Text>
        </Card>
      ))}
    </SimpleGrid>
  );
}
