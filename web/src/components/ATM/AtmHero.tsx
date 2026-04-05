import { Card, Text, Group, Box, Badge, Stack, rem } from '@mantine/core';
import type { Account } from '../../types';
import {
  formatMoney,
  accountMask,
  accountTone,
  relativeTime,
} from '../../lib/formatters';
import { useBankingStore } from '../../store/bankingStore';

interface AtmHeroProps {
  account: Account | null;
  t: (key: string, fallback?: string) => string;
}

export default function AtmHero({ account, t }: AtmHeroProps) {
  const currency = useBankingStore((s) => s.currency);
  const locale = useBankingStore((s) => s.locale);
  const theme = useBankingStore((s) => s.theme);
  const latestTx = account?.transactions?.[0];

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
      <Group justify="space-between" align="flex-start">
        <Stack gap={rem(8)}>
          <Group gap={rem(8)}>
            <Badge
              variant="outline"
              size="sm"
              style={{
                background: 'var(--rb-surface)',
                borderColor: 'var(--rb-border)',
                color: 'var(--rb-text-muted)',
              }}
            >
              {t('atmTerminal', 'Self-Service')}
            </Badge>
            <Text size="xs" style={{ color: 'var(--rb-text-soft)', letterSpacing: 1 }}>
              {account ? accountMask(account) : '---- ----'}
            </Text>
          </Group>

          <Text
            fw={800}
            style={{
              fontFamily: 'var(--mantine-font-family-headings)',
              color: 'var(--rb-text)',
              fontSize: rem(22),
              lineHeight: 1.2,
            }}
          >
            {account ? (account.name || account.id) : 'Kein Konto'}
          </Text>
          <Text size="xs" style={{ color: 'var(--rb-text-muted)' }}>
            {account ? accountTone(account, locale) : ''} · {account ? account.id : '-'}
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
            {formatMoney(account?.amount ?? 0, currency)}
          </Text>
        </Stack>

        {/* ATM summary box */}
        <Box
          p={rem(16)}
          style={{
            background: 'var(--rb-surface)',
            border: '1px solid var(--rb-border)',
            borderRadius: rem(12),
            textAlign: 'center',
            minWidth: rem(140),
          }}
        >
          <Text size="xs" style={{ color: 'var(--rb-text-muted)' }}>Verfügbar</Text>
          <Text
            fw={700}
            style={{ color: 'var(--rb-accent)', fontSize: rem(18) }}
          >
            {formatMoney(account?.amount ?? 0, currency)}
          </Text>
          <Text size="xs" style={{ color: 'var(--rb-text-soft)' }}>
            {account ? account.id : '-'}
          </Text>
          {latestTx && (
            <Text size="xs" style={{ color: 'var(--rb-text-muted)' }} mt={rem(4)}>
              {relativeTime(latestTx.time, locale)}
            </Text>
          )}
        </Box>
      </Group>
    </Card>
  );
}
