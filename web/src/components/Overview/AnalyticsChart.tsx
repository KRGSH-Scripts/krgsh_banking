import { Card, Text, Group, Box, rem } from '@mantine/core';
import { BarChart } from '@mantine/charts';
import type { Account } from '../../types';
import { chartBuckets, formatMoney } from '../../lib/formatters';
import { useBankingStore } from '../../store/bankingStore';

interface AnalyticsChartProps {
  account: Account | null;
  t: (key: string, fallback?: string) => string;
}

export default function AnalyticsChart({ account, t }: AnalyticsChartProps) {
  const currency = useBankingStore((s) => s.currency);

  if (!account) return null;

  const buckets = chartBuckets(account);

  if (buckets.length === 0) {
    return (
      <Card
        p={rem(20)}
        style={{
          background: 'var(--rb-card)',
          border: '1px solid var(--rb-border)',
          borderRadius: rem(16),
        }}
      >
        <Text size="xs" c="dimmed" tt="uppercase" fw={600} lts={0.5} mb={rem(8)}>
          {t('performance', 'Buchungsbewegung')}
        </Text>
        <Text style={{ color: 'var(--rb-text-muted)' }} size="sm">
          {t('noTransactions', 'Keine Buchungen vorhanden')}
        </Text>
      </Card>
    );
  }

  const chartData = buckets.map((b, i) => ({
    name: `#${i + 1}`,
    Eingang: b.type === 'in' ? b.value : 0,
    Ausgang: b.type === 'out' ? b.value : 0,
  }));

  return (
    <Card
      p={rem(20)}
      style={{
        background: 'var(--rb-card)',
        border: '1px solid var(--rb-border)',
        borderRadius: rem(16),
      }}
    >
      <Group justify="space-between" mb={rem(16)}>
        <Box>
          <Text size="xs" c="dimmed" tt="uppercase" fw={600} lts={0.5}>
            {t('performance', 'Buchungsbewegung')}
          </Text>
          <Text fw={600} style={{ color: 'var(--rb-text)' }}>
            Bewegung der letzten Buchungen
          </Text>
        </Box>
        <Text size="xs" style={{ color: 'var(--rb-text-muted)' }}>
          Die letzten sechs Buchungen
        </Text>
      </Group>

      <BarChart
        h={180}
        data={chartData}
        dataKey="name"
        series={[
          { name: 'Eingang', color: 'var(--rb-inflow)' },
          { name: 'Ausgang', color: 'var(--rb-danger)' },
        ]}
        tooltipAnimationDuration={200}
        valueFormatter={(value) => formatMoney(value, currency)}
        gridAxis="none"
        withLegend={false}
        withTooltip
        barProps={{ radius: 4 }}
        styles={{
          root: { background: 'transparent' },
          axis: { stroke: 'var(--rb-border)' },
        }}
      />
    </Card>
  );
}
