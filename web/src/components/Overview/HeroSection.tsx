import {
  Box,
  Card,
  Text,
  Group,
  Badge,
  RingProgress,
  Stack,
  rem,
} from '@mantine/core';
import { useViewportSize } from '@mantine/hooks';
import type { Account } from '../../types';
import {
  formatMoney,
  formatDate,
  relativeTime,
  displayAccountNumber,
  accountTone,
  metricsForAccount,
} from '../../lib/formatters';
import { useBankingStore } from '../../store/bankingStore';

interface HeroSectionProps {
  account: Account | null;
  accounts: Account[];
  t: (key: string, fallback?: string) => string;
}

export default function HeroSection({ account, accounts: _accounts, t }: HeroSectionProps) {
  const currency = useBankingStore((s) => s.currency);
  const locale = useBankingStore((s) => s.locale);
  const theme = useBankingStore((s) => s.theme);
  const { width: vw } = useViewportSize();
  // Scale ring proportionally to viewport; clamp between 90 and 240px
  const ringSize = Math.max(90, Math.min(240, Math.round(vw * 120 / 1920)));

  if (!account) {
    return (
      <Card
        p={rem(24)}
        style={{
          background: 'var(--rb-card)',
          border: '1px solid var(--rb-border)',
          borderRadius: rem(16),
        }}
      >
        <Text style={{ color: 'var(--rb-text-muted)' }}>
          {t('noAccounts', 'Keine Konten vorhanden')}
        </Text>
      </Card>
    );
  }

  const metrics = metricsForAccount(account);
  const flowTotal = Math.max(1, metrics.inflow + metrics.outflow);
  const inflowPct = Math.round((metrics.inflow / flowTotal) * 100);
  const latestTx = account.transactions?.[0];
  const isFrozen = Number(account.frozen) > 0 || account.frozen === true;

  return (
    <Card
      p={rem(24)}
      style={{
        background: 'linear-gradient(135deg, var(--rb-card) 60%, var(--rb-surface))',
        border: '1px solid var(--rb-border)',
        borderRadius: rem(16),
        boxShadow: `0 8px 32px ${theme.colors.glow}`,
      }}
    >
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        {/* Left: Account info */}
        <Stack gap={rem(8)} style={{ flex: 1, minWidth: 0 }}>
          <Group gap={rem(8)}>
            <Badge
              variant="outline"
              style={{
                background: 'var(--rb-surface)',
                borderColor: 'var(--rb-border)',
                color: 'var(--rb-text-muted)',
              }}
              size="sm"
            >
              {accountTone(account, locale)}
            </Badge>
            <Text size="xs" style={{ color: 'var(--rb-text-soft)', letterSpacing: 1 }}>
              {displayAccountNumber(account)}
            </Text>
            {isFrozen && (
              <Badge color="red" size="xs">
                {t('frozen', 'Gesperrt')}
              </Badge>
            )}
          </Group>

          <Text
            fw={800}
            style={{
              color: 'var(--rb-text)',
              fontFamily: 'var(--mantine-font-family-headings)',
              fontSize: rem(22),
              lineHeight: 1.2,
            }}
            truncate
          >
            {account.name || account.id}
          </Text>
          <Text size="xs" style={{ color: 'var(--rb-text-muted)' }}>
            {accountTone(account, locale)} · {displayAccountNumber(account)}
            {theme.location ? ` · ${theme.location}` : ''}
          </Text>

          <Text
            fw={800}
            style={{
              color: 'var(--rb-accent)',
              fontFamily: 'var(--mantine-font-family-headings)',
              fontSize: rem(36),
              lineHeight: 1,
              marginTop: rem(4),
            }}
          >
            {formatMoney(account.amount, currency)}
          </Text>

          <Group gap={rem(24)} mt={rem(4)}>
            <Box>
              <Text size="xs" style={{ color: 'var(--rb-text-muted)' }}>
                {t('available_balance', 'Verfügbarer Kontostand')}
              </Text>
              <Text fw={600} size="sm" style={{ color: 'var(--rb-text)' }}>
                {formatMoney(account.amount, currency)}
              </Text>
            </Box>
            <Box>
              <Text size="xs" style={{ color: 'var(--rb-text-muted)' }}>
                {t('date', 'Letzte Buchung')}
              </Text>
              <Text fw={600} size="sm" style={{ color: 'var(--rb-text)' }}>
                {latestTx ? relativeTime(latestTx.time, locale) : '-'}
              </Text>
            </Box>
            {latestTx && (
              <Box>
                <Text size="xs" style={{ color: 'var(--rb-text-muted)' }}>
                  Datum
                </Text>
                <Text fw={600} size="sm" style={{ color: 'var(--rb-text)' }}>
                  {formatDate(latestTx.time)}
                </Text>
              </Box>
            )}
          </Group>
        </Stack>

        {/* Right: Flow ring */}
        <Box style={{ flexShrink: 0, textAlign: 'center' }}>
          <RingProgress
            size={ringSize}
            thickness={Math.round(ringSize / 12)}
            sections={[
              { value: inflowPct, color: 'var(--rb-accent)' },
              { value: 100 - inflowPct, color: 'var(--rb-flow-out)' },
            ]}
            label={
              <Box ta="center">
                <Text fw={700} size="sm" style={{ color: 'var(--rb-text)' }}>
                  {inflowPct}%
                </Text>
                <Text size="xs" style={{ color: 'var(--rb-text-muted)' }}>
                  {t('inflow', 'Eingänge')}
                </Text>
              </Box>
            }
          />
          <Stack gap={rem(4)} mt={rem(8)}>
            <Group gap={rem(6)} justify="center">
              <Box
                style={{
                  width: rem(8),
                  height: rem(8),
                  borderRadius: '50%',
                  background: 'var(--rb-accent)',
                }}
              />
              <Text size="xs" style={{ color: 'var(--rb-text-muted)' }}>
                {t('inflow', 'Eingänge')}:{' '}
                <strong style={{ color: 'var(--rb-text)' }}>
                  {formatMoney(metrics.inflow, currency)}
                </strong>
              </Text>
            </Group>
            <Group gap={rem(6)} justify="center">
              <Box
                style={{
                  width: rem(8),
                  height: rem(8),
                  borderRadius: '50%',
                  background: 'var(--rb-danger)',
                }}
              />
              <Text size="xs" style={{ color: 'var(--rb-text-muted)' }}>
                {t('outflow', 'Ausgänge')}:{' '}
                <strong style={{ color: 'var(--rb-text)' }}>
                  {formatMoney(metrics.outflow, currency)}
                </strong>
              </Text>
            </Group>
          </Stack>
        </Box>
      </Group>
    </Card>
  );
}
