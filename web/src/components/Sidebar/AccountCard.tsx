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

function isPersonalAccount(account: Account): boolean {
  return String(account.type ?? '').toLowerCase().includes('personal');
}

function cardBackground(account: Account): string {
  const personal = isPersonalAccount(account);
  if (personal) {
    return [
      'linear-gradient(148deg, #0a0e0d 0%, #0f1614 42%, rgba(52, 211, 153, 0.11) 100%)',
      'radial-gradient(100% 80% at 100% -10%, rgba(52, 211, 153, 0.18), transparent 55%)',
    ].join(', ');
  }
  return [
    'linear-gradient(148deg, #0c0a10 0%, #120e16 42%, transparent 100%)',
    'radial-gradient(90% 70% at 100% 0%, var(--rb-glow), transparent 60%)',
  ].join(', ');
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
        padding: rem(14),
        borderRadius: rem(16),
        border: selected
          ? '2px solid var(--rb-accent)'
          : '1px solid rgba(255,255,255,0.12)',
        background: cardBackground(account),
        backgroundColor: '#08080a',
        cursor: 'pointer',
        textAlign: 'left',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: selected
          ? '0 0 0 3px var(--rb-glow), 0 14px 32px rgba(0,0,0,0.55)'
          : '0 10px 24px rgba(0,0,0,0.4)',
        transform: selected ? 'translateY(-1px)' : 'none',
        transition:
          'border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease',
      }}
    >
      {/* Glanz */}
      <Box
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(125deg, rgba(255,255,255,0.07) 0%, transparent 42%, transparent 100%)',
          pointerEvents: 'none',
        }}
      />

      <Box style={{ position: 'relative' }}>
        <Group justify="space-between" align="flex-start" wrap="nowrap" mb={rem(10)}>
          <Group gap={rem(10)} wrap="nowrap" align="center">
            <Box
              style={{
                width: rem(38),
                height: rem(28),
                borderRadius: rem(5),
                background:
                  'linear-gradient(145deg, #e8d5a3 0%, #b8932e 45%, #6b5420 100%)',
                boxShadow:
                  'inset 0 1px 0 rgba(255,255,255,0.35), 0 2px 6px rgba(0,0,0,0.35)',
                flexShrink: 0,
              }}
            />
            <Box style={{ minWidth: 0 }}>
              <Text
                size="xs"
                fw={600}
                tt="uppercase"
                lts={0.8}
                style={{ color: 'rgba(255,255,255,0.55)', lineHeight: 1.2 }}
              >
                {accountTone(account, locale)}
              </Text>
              <Text
                fw={700}
                size="sm"
                truncate
                style={{
                  color: 'var(--rb-accent-contrast)',
                  lineHeight: 1.35,
                  fontFamily: 'var(--mantine-font-family-headings)',
                }}
              >
                {account.name || account.id}
              </Text>
            </Box>
          </Group>
          <Badge
            size="xs"
            variant="outline"
            color={isFrozen ? 'red' : 'teal'}
            style={{
              fontSize: rem(9),
              flexShrink: 0,
              borderColor: isFrozen ? undefined : 'rgba(52, 211, 153, 0.45)',
              color: isFrozen ? undefined : 'var(--rb-inflow-strong)',
            }}
          >
            {isFrozen ? t('frozen', 'Gesperrt') : t('available', 'Aktiv')}
          </Badge>
        </Group>

        <Text
          size="xs"
          ff="monospace"
          style={{
            color: 'rgba(255,255,255,0.45)',
            letterSpacing: rem(2),
            marginBottom: rem(12),
          }}
        >
          {accountMask(account)}
        </Text>

        <Group justify="space-between" align="flex-end" wrap="nowrap">
          <Box style={{ minWidth: 0 }}>
            <Text
              size="xs"
              tt="uppercase"
              fw={600}
              lts={0.6}
              style={{ color: 'rgba(255,255,255,0.4)', marginBottom: rem(2) }}
            >
              {t('available_balance', 'Verfügbar')}
            </Text>
            <Text
              fw={700}
              style={{
                color: selected ? 'var(--rb-accent-contrast)' : 'var(--rb-text)',
                fontSize: rem(20),
                fontFamily: 'var(--mantine-font-family-headings)',
                lineHeight: 1.1,
                textShadow: selected ? '0 0 20px var(--rb-glow)' : undefined,
              }}
            >
              {formatMoney(account.amount, currency)}
            </Text>
          </Box>
          <Box ta="right" style={{ flexShrink: 0 }}>
            <Badge
              size="xs"
              variant="filled"
              style={{
                background: 'rgba(0,0,0,0.35)',
                color: 'rgba(255,255,255,0.65)',
                fontSize: rem(9),
                letterSpacing: 0.5,
              }}
            >
              {tag}
            </Badge>
            {latestTx && (
              <Text
                size="xs"
                style={{ color: 'rgba(255,255,255,0.38)', marginTop: rem(4) }}
              >
                {relativeTime(latestTx.time, locale)}
              </Text>
            )}
          </Box>
        </Group>
      </Box>
    </UnstyledButton>
  );
}
