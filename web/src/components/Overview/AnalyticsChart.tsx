import { useState } from 'react';
import { Card, Text, Group, Box, rem, SegmentedControl } from '@mantine/core';
import { LineChart } from '@mantine/charts';
import type { Account } from '../../types';
import {
  dailyMovementSeries,
  dailySeriesHasActivity,
  formatMoney,
} from '../../lib/formatters';
import { useBankingStore } from '../../store/bankingStore';

interface AnalyticsChartProps {
  account: Account | null;
  t: (key: string, fallback?: string) => string;
}

export default function AnalyticsChart({ account, t }: AnalyticsChartProps) {
  const currency = useBankingStore((s) => s.currency);
  const [range, setRange] = useState<'7' | '30'>('7');
  const dayCount = range === '7' ? 7 : 30;

  if (!account) return null;

  const series = dailyMovementSeries(account, dayCount);
  const hasActivity = dailySeriesHasActivity(series);

  if (!hasActivity) {
    return (
      <Card
        p={rem(20)}
        style={{
          background: 'var(--rb-card)',
          border: '1px solid var(--rb-border)',
          borderRadius: rem(16),
        }}
      >
        <Group justify="space-between" mb={rem(12)} wrap="wrap">
          <Box>
            <Text size="xs" c="dimmed" tt="uppercase" fw={600} lts={0.5}>
              {t('performance', 'Buchungsbewegung')}
            </Text>
            <Text fw={600} style={{ color: 'var(--rb-text)' }}>
              {t('chart_daily_title', 'Taegliche Buchungen')}
            </Text>
            <Text size="sm" mt={rem(4)} style={{ color: 'var(--rb-text-muted)' }}>
              {t(
                'chart_daily_subtitle',
                'Summen pro Kalendertag (Einzahlung und Auszahlung)',
              )}
            </Text>
          </Box>
          <SegmentedControl
            value={range}
            onChange={(v) => setRange(v as '7' | '30')}
            data={[
              { value: '7', label: t('chart_range_7', '7 Tage') },
              { value: '30', label: t('chart_range_30', '30 Tage') },
            ]}
            size="xs"
            styles={{
              root: { background: 'var(--rb-surface2, rgba(0,0,0,0.2))' },
            }}
          />
        </Group>
        <Text style={{ color: 'var(--rb-text-muted)' }} size="sm">
          {t(
            'chart_no_activity_period',
            'Keine Buchungen in diesem Zeitraum',
          )}
        </Text>
      </Card>
    );
  }

  const chartData = series.map((p) => ({
    day: p.day,
    deposit: p.deposit,
    withdraw: p.withdraw,
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
      <Group justify="space-between" mb={rem(16)} wrap="wrap" align="flex-start">
        <Box>
          <Text size="xs" c="dimmed" tt="uppercase" fw={600} lts={0.5}>
            {t('performance', 'Buchungsbewegung')}
          </Text>
          <Text fw={600} style={{ color: 'var(--rb-text)' }}>
            {t('chart_daily_title', 'Taegliche Buchungen')}
          </Text>
          <Text size="sm" mt={rem(4)} style={{ color: 'var(--rb-text-muted)' }}>
            {t(
              'chart_daily_subtitle',
              'Summen pro Kalendertag (Einzahlung und Auszahlung)',
            )}
          </Text>
        </Box>
        <SegmentedControl
          value={range}
          onChange={(v) => setRange(v as '7' | '30')}
          data={[
            { value: '7', label: t('chart_range_7', '7 Tage') },
            { value: '30', label: t('chart_range_30', '30 Tage') },
          ]}
          size="xs"
          styles={{
            root: { background: 'var(--rb-surface2, rgba(0,0,0,0.2))' },
          }}
        />
      </Group>

      <LineChart
        h={200}
        data={chartData}
        dataKey="day"
        series={[
          {
            name: 'deposit',
            color: 'var(--rb-inflow)',
            label: t('deposit_but', 'Einzahlung'),
          },
          {
            name: 'withdraw',
            color: 'var(--rb-danger)',
            label: t('withdraw_but', 'Auszahlung'),
          },
        ]}
        curveType="monotone"
        strokeWidth={2}
        withDots={dayCount === 7}
        dotProps={{ r: 3 }}
        tooltipAnimationDuration={200}
        valueFormatter={(value) => formatMoney(value, currency)}
        gridAxis="x"
        withLegend
        withTooltip
        styles={{
          root: { background: 'transparent' },
          axis: { stroke: 'var(--rb-border)' },
        }}
      />
    </Card>
  );
}
