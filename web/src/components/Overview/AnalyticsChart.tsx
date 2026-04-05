import { useState } from 'react';
import {
  Card,
  Text,
  Group,
  Box,
  rem,
  SegmentedControl,
  ThemeIcon,
} from '@mantine/core';
import {
  IconTrendingDown,
  IconTrendingUp,
  IconMinus,
} from '@tabler/icons-react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TooltipProps } from 'recharts';

import type { Account } from '../../types';
import {
  dailyBalanceOhlcSeries,
  formatMoney,
  trendFromCloses,
  type DailyOhlcPoint,
} from '../../lib/formatters';
import { useBankingStore } from '../../store/bankingStore';
import { CandlestickShape } from './CandlestickShape';

interface AnalyticsChartProps {
  account: Account | null;
  t: (key: string, fallback?: string) => string;
}

function chartMoneyLabel(value: number, currency: string): string {
  return formatMoney(value, currency);
}

function BalanceChartTooltip({
  active,
  payload,
  currency,
  t,
}: TooltipProps<number, string> & {
  currency: string;
  t: (key: string, fallback?: string) => string;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as DailyOhlcPoint | undefined;
  if (!row) return null;

  const line = (labelKey: string, fallback: string, v: number) => (
    <Group justify="space-between" gap="md" wrap="nowrap">
      <Text size="xs" c="dimmed">
        {t(labelKey, fallback)}
      </Text>
      <Text size="xs" fw={500} style={{ color: 'var(--rb-text)' }}>
        {formatMoney(v, currency)}
      </Text>
    </Group>
  );

  return (
    <Box
      p={rem(10)}
      style={{
        background: 'var(--rb-card)',
        border: '1px solid var(--rb-border)',
        borderRadius: rem(8),
        minWidth: rem(200),
      }}
    >
      <Text size="xs" fw={600} mb={rem(6)} style={{ color: 'var(--rb-text)' }}>
        {row.day}
      </Text>
      {line('chart_tooltip_open', 'Eroeffnung', row.open)}
      {line('chart_tooltip_high', 'Hoch', row.high)}
      {line('chart_tooltip_low', 'Tief', row.low)}
      {line('chart_tooltip_close', 'Schluss', row.close)}
    </Box>
  );
}

export default function AnalyticsChart({ account, t }: AnalyticsChartProps) {
  const currency = useBankingStore((s) => s.currency);
  const [range, setRange] = useState<'7' | '30'>('7');
  const dayCount = range === '7' ? 7 : 30;

  if (!account) return null;

  const series = dailyBalanceOhlcSeries(account, dayCount);
  const trend = trendFromCloses(series);

  const trendLabel =
    trend.direction === 'up'
      ? t('chart_trend_up', 'Steigend')
      : trend.direction === 'down'
        ? t('chart_trend_down', 'Fallend')
        : t('chart_trend_flat', 'Stabil');

  const trendIcon =
    trend.direction === 'up' ? (
      <IconTrendingUp size={16} stroke={1.75} />
    ) : trend.direction === 'down' ? (
      <IconTrendingDown size={16} stroke={1.75} />
    ) : (
      <IconMinus size={16} stroke={1.75} />
    );

  const trendColor =
    trend.direction === 'up'
      ? 'var(--rb-inflow)'
      : trend.direction === 'down'
        ? 'var(--rb-danger)'
        : 'var(--rb-text-muted)';

  const pctStr = `${trend.deltaPct >= 0 ? '+' : ''}${trend.deltaPct.toLocaleString('de-DE', {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  })}%`;

  const headerBlock = (
    <Group justify="space-between" mb={rem(16)} wrap="wrap" align="flex-start">
      <Box style={{ flex: '1 1 200px' }}>
        <Text size="xs" c="dimmed" tt="uppercase" fw={600} lts={0.5}>
          {t('performance', 'Buchungsbewegung')}
        </Text>
        <Group gap="sm" align="center" wrap="wrap" mt={rem(4)}>
          <Text fw={600} style={{ color: 'var(--rb-text)' }}>
            {t('chart_balance_title', 'Kontostand & Tagesrange')}
          </Text>
          <Group gap={6} align="center" wrap="nowrap">
            <ThemeIcon
              variant="light"
              size="sm"
              radius="md"
              style={{
                background: 'var(--rb-surface2, rgba(0,0,0,0.2))',
                color: trendColor,
              }}
            >
              {trendIcon}
            </ThemeIcon>
            <Text size="sm" fw={600} style={{ color: trendColor }}>
              {pctStr}
            </Text>
            <Text size="sm" c="dimmed">
              {trendLabel}
            </Text>
          </Group>
        </Group>
        <Text size="sm" mt={rem(4)} style={{ color: 'var(--rb-text-muted)' }}>
          {t(
            'chart_balance_subtitle',
            'Linie: Schlusskontostand pro Tag. Kerzen: Tagesverlauf (OHLC).',
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
  );

  return (
    <Card
      p={rem(20)}
      style={{
        background: 'var(--rb-card)',
        border: '1px solid var(--rb-border)',
        borderRadius: rem(16),
      }}
    >
      {headerBlock}

      <Group gap="lg" mb={rem(8)} wrap="wrap">
        <Group gap={6} align="center">
          <Box
            w={rem(14)}
            h={rem(3)}
            style={{
              background: 'var(--rb-accent)',
              borderRadius: rem(2),
            }}
          />
          <Text size="xs" c="dimmed">
            {t('chart_balance_line', 'Schlusskontostand')}
          </Text>
        </Group>
        <Group gap={6} align="center">
          <Box
            w={rem(10)}
            h={rem(10)}
            style={{
              background: 'var(--rb-inflow)',
              borderRadius: rem(2),
            }}
          />
          <Text size="xs" c="dimmed">
            {t('chart_candle_bull', 'Tagesschluss >= Eroeffnung')}
          </Text>
        </Group>
        <Group gap={6} align="center">
          <Box
            w={rem(10)}
            h={rem(10)}
            style={{
              background: 'var(--rb-danger)',
              borderRadius: rem(2),
            }}
          />
          <Text size="xs" c="dimmed">
            {t('chart_candle_bear', 'Tagesschluss < Eroeffnung')}
          </Text>
        </Group>
      </Group>

      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart
          layout="horizontal"
          data={series}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--rb-border)"
            vertical={false}
          />
          <XAxis
            dataKey="day"
            tick={{ fill: 'var(--rb-text-muted)', fontSize: 11 }}
            axisLine={{ stroke: 'var(--rb-border)' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: 'var(--rb-text-muted)', fontSize: 11 }}
            axisLine={{ stroke: 'var(--rb-border)' }}
            tickLine={false}
            tickFormatter={(v) => chartMoneyLabel(Number(v), currency)}
            width={56}
          />
          <Tooltip
            content={
              <BalanceChartTooltip currency={currency} t={t} />
            }
          />
          <Bar
            layout="horizontal"
            dataKey={(d: DailyOhlcPoint) => [d.low, d.high]}
            fill="transparent"
            shape={CandlestickShape}
            isAnimationActive={false}
            legendType="none"
          />
          <Line
            type="monotone"
            dataKey="close"
            name={t('chart_balance_line', 'Schlusskontostand')}
            stroke="var(--rb-accent)"
            strokeWidth={2}
            dot={dayCount === 7 ? { r: 3, fill: 'var(--rb-accent)' } : false}
            activeDot={{ r: 4 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </Card>
  );
}
