import { Box, Text, Group, Badge, UnstyledButton, rem } from '@mantine/core';
import type { Account } from '../../types';
import {
  formatMoney,
  accountMask,
  accountTone,
  themeTag,
  relativeTime,
} from '../../lib/formatters';

interface AccountCardProps {
  account: Account;
  selected: boolean;
  onClick: () => void;
  t: (key: string, fallback?: string) => string;
  currency: string;
  locale: Record<string, string>;
}

export default function AccountCard({
  account,
  selected,
  onClick,
  t,
  currency,
  locale,
}: AccountCardProps) {
  const latestTx = account.transactions?.[0];
  const tag = themeTag(account);
  const isFrozen = Number(account.frozen) > 0 || account.frozen === true;

  return (
    <UnstyledButton
      onClick={onClick}
      style={{
        display: 'block',
        width: '100%',
        padding: rem(12),
        borderRadius: rem(12),
        border: `1px solid ${selected ? 'var(--rb-accent)' : 'var(--rb-border)'}`,
        background: selected ? 'rgba(255,255,255,0.05)' : 'var(--rb-surface)',
        cursor: 'pointer',
        transition: 'border-color 0.15s, background 0.15s',
      }}
    >
      {/* Head row */}
      <Group justify="space-between" mb={rem(4)}>
        <Text size="xs" style={{ color: 'var(--rb-text-muted)' }}>
          {accountTone(account, locale)}
        </Text>
        <Badge
          size="xs"
          variant="outline"
          color={isFrozen ? 'red' : 'teal'}
          style={{ fontSize: rem(9) }}
        >
          {isFrozen ? t('frozen', 'Gesperrt') : t('available', 'Aktiv')}
        </Badge>
      </Group>

      {/* Account name */}
      <Text
        fw={600}
        size="sm"
        style={{ color: 'var(--rb-text)', lineHeight: 1.3 }}
        truncate
      >
        {account.name || account.id}
      </Text>

      {/* Mask */}
      <Text size="xs" style={{ color: 'var(--rb-text-muted)', letterSpacing: 1 }} mb={rem(8)}>
        {accountMask(account)}
      </Text>

      {/* Balance row */}
      <Group justify="space-between" align="flex-end">
        <Box>
          <Text size="xs" style={{ color: 'var(--rb-text-muted)' }}>
            {t('available_balance', 'Verfügbar')}
          </Text>
          <Text
            fw={700}
            size="sm"
            style={{ color: selected ? 'var(--rb-accent)' : 'var(--rb-text)' }}
          >
            {formatMoney(account.amount, currency)}
          </Text>
        </Box>
        <Box ta="right">
          <Badge
            size="xs"
            variant="filled"
            style={{
              background: 'var(--rb-chip-bg)',
              color: 'var(--rb-text-muted)',
              fontSize: rem(9),
            }}
          >
            {tag}
          </Badge>
          {latestTx && (
            <Text size="xs" style={{ color: 'var(--rb-text-soft)' }} mt={rem(2)}>
              {relativeTime(latestTx.time, locale)}
            </Text>
          )}
        </Box>
      </Group>
    </UnstyledButton>
  );
}
