import { Card, Text, Group, SimpleGrid, UnstyledButton, rem } from '@mantine/core';
import type { Account } from '../../types';
import { formatMoney } from '../../lib/formatters';
import { useBankingStore } from '../../store/bankingStore';

const PRESET_AMOUNTS = [50, 100, 250, 500, 1000, 2500, 5000, 10000, 15000];

interface AtmKeypadProps {
  selectedAccount: Account | null;
  t: (key: string, fallback?: string) => string;
}

export default function AtmKeypad({ selectedAccount, t }: AtmKeypadProps) {
  const currency = useBankingStore((s) => s.currency);
  const openModal = useBankingStore((s) => s.openModal);

  if (!selectedAccount) return null;

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
        <div>
          <Text size="xs" c="dimmed" tt="uppercase" fw={600} lts={0.5}>
            {t('keypad', 'Schnellbeträge')}
          </Text>
          <Text fw={600} style={{ color: 'var(--rb-text)' }}>
            Schnellabhebung
          </Text>
        </div>
        <Text size="xs" style={{ color: 'var(--rb-text-muted)' }}>
          Wähle einen Betrag für eine direkte Abhebung.
        </Text>
      </Group>

      <SimpleGrid cols={{ base: 3, sm: 3 }} spacing={rem(8)}>
        {PRESET_AMOUNTS.map((amount) => (
          <UnstyledButton
            key={amount}
            onClick={() => openModal({ type: 'withdraw', presetAmount: amount })}
            style={{
              padding: `${rem(12)} ${rem(8)}`,
              borderRadius: rem(10),
              background: 'var(--rb-surface)',
              border: '1px solid var(--rb-border)',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'border-color 0.15s, background 0.15s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = 'var(--rb-accent)';
              (e.currentTarget as HTMLElement).style.background = 'var(--rb-fill-raised)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = 'var(--rb-border)';
              (e.currentTarget as HTMLElement).style.background = 'var(--rb-surface)';
            }}
          >
            <Text fw={700} size="sm" style={{ color: 'var(--rb-accent)' }}>
              {formatMoney(amount, currency)}
            </Text>
            <Text size="xs" style={{ color: 'var(--rb-text-muted)' }}>
              Direkt abheben
            </Text>
          </UnstyledButton>
        ))}
      </SimpleGrid>
    </Card>
  );
}
