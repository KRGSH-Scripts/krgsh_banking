import { Card, Text, Group, Box, Stack, Divider, rem } from '@mantine/core';
import type { Account } from '../../types';
import {
  formatMoney,
  formatDate,
  relativeTime,
  displayAccountNumber,
} from '../../lib/formatters';
import { useBankingStore } from '../../store/bankingStore';

interface AtmRecentProps {
  account: Account | null;
  t: (key: string, fallback?: string) => string;
}

export default function AtmRecent({ account, t }: AtmRecentProps) {
  const currency = useBankingStore((s) => s.currency);
  const locale = useBankingStore((s) => s.locale);

  if (!account) return null;

  const txs = (account.transactions ?? []).slice(0, 5);

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
            {t('recentTransactions', 'Letzte Buchungen')}
          </Text>
          <Text fw={600} style={{ color: 'var(--rb-text)' }}>
            Letzte ATM-relevante Buchungen
          </Text>
        </Box>
        <Text size="xs" style={{ color: 'var(--rb-text-muted)' }}>
          {displayAccountNumber(account)}
        </Text>
      </Group>

      {txs.length === 0 ? (
        <Text size="sm" style={{ color: 'var(--rb-text-muted)' }} ta="center" py={rem(16)}>
          {t('noTransactions', 'Keine Buchungen gefunden')}
        </Text>
      ) : (
        <Stack gap={0}>
          {txs.map((tx, i) => {
            const isIn = (tx.trans_type ?? '').toLowerCase() === 'deposit';
            return (
              <Box key={tx.trans_id}>
                <Group py={rem(10)} justify="space-between" wrap="nowrap">
                  <Box
                    style={{
                      width: rem(32),
                      height: rem(32),
                      borderRadius: '50%',
                      background: isIn ? 'var(--rb-inflow-muted-bg)' : 'rgba(251,113,133,0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      fontSize: rem(14),
                      fontWeight: 700,
                      color: isIn ? 'var(--rb-inflow)' : 'var(--rb-danger)',
                    }}
                  >
                    {isIn ? '+' : '−'}
                  </Box>
                  <Box style={{ flex: 1, minWidth: 0 }}>
                    <Text size="sm" fw={600} style={{ color: 'var(--rb-text)' }} truncate>
                      {tx.message || tx.title || '-'}
                    </Text>
                    <Text size="xs" style={{ color: 'var(--rb-text-muted)' }}>
                      {tx.receiver || tx.issuer || '-'}
                    </Text>
                    <Text size="xs" style={{ color: 'var(--rb-text-soft)' }}>
                      {formatDate(tx.time)}
                    </Text>
                  </Box>
                  <Box ta="right" style={{ flexShrink: 0 }}>
                    <Text fw={700} size="sm" className={isIn ? 'amount-in' : 'amount-out'}>
                      {isIn ? '+' : '−'}{formatMoney(tx.amount, currency)}
                    </Text>
                    <Text size="xs" style={{ color: 'var(--rb-text-muted)' }}>
                      {relativeTime(tx.time, locale)}
                    </Text>
                  </Box>
                </Group>
                {i < txs.length - 1 && <Divider color="var(--rb-divider)" />}
              </Box>
            );
          })}
        </Stack>
      )}
    </Card>
  );
}
