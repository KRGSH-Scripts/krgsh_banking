import { SimpleGrid, Card, Text, rem } from '@mantine/core';
import type { Account } from '../../types';
import {
  formatMoney,
  formatDate,
  sumAccountBalances,
  getCashBalance,
  latestTransaction,
} from '../../lib/formatters';
import { useBankingStore } from '../../store/bankingStore';

interface KpiGridProps {
  accounts: Account[];
  t: (key: string, fallback?: string) => string;
}

export default function KpiGrid({ accounts, t }: KpiGridProps) {
  const currency = useBankingStore((s) => s.currency);
  const latest = latestTransaction(accounts);
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
      label: t('date', 'Letzte Buchung'),
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
