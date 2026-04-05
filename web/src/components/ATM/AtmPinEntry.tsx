import { Card, Group, SimpleGrid, Text, UnstyledButton, Button, rem } from '@mantine/core';
import type { AtmCardOption } from '../../types';

interface AtmPinEntryProps {
  card: AtmCardOption;
  pin: string;
  onPinChange: (next: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  loading: boolean;
  t: (key: string, fallback?: string) => string;
}

const MAX_PIN = 12;

export default function AtmPinEntry({
  card,
  pin,
  onPinChange,
  onCancel,
  onConfirm,
  loading,
  t,
}: AtmPinEntryProps) {
  function append(d: string) {
    if (pin.length >= MAX_PIN) return;
    onPinChange(pin + d);
  }

  function clear() {
    onPinChange('');
  }

  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'OK'];

  return (
    <Card
      p={rem(20)}
      style={{
        background: 'var(--rb-card)',
        border: '1px solid var(--rb-border)',
        borderRadius: rem(16),
      }}
    >
      <Text size="xs" c="dimmed" tt="uppercase" fw={600} lts={0.5} mb={rem(6)}>
        {t('atm_pin_title', 'PIN eingeben')}
      </Text>
      <Text size="sm" mb={rem(12)} style={{ color: 'var(--rb-text-muted)' }} truncate>
        {card.label || card.accountName}
      </Text>
      <Text
        fw={700}
        size="xl"
        ta="center"
        mb={rem(16)}
        style={{
          color: 'var(--rb-text)',
          letterSpacing: rem(4),
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {pin.length > 0 ? '•'.repeat(pin.length) : '—'}
      </Text>

      <SimpleGrid cols={3} spacing={rem(8)} mb={rem(16)}>
        {digits.map((d) => {
          if (d === 'C') {
            return (
              <UnstyledButton
                key={d}
                type="button"
                onClick={clear}
                disabled={loading}
                style={{
                  padding: rem(14),
                  borderRadius: rem(10),
                  background: 'var(--rb-surface)',
                  border: '1px solid var(--rb-border)',
                  textAlign: 'center',
                  color: 'var(--rb-danger)',
                  fontWeight: 700,
                }}
              >
                {t('atm_pin_clear', 'Löschen')}
              </UnstyledButton>
            );
          }
          if (d === 'OK') {
            return (
              <UnstyledButton
                key={d}
                type="button"
                onClick={onConfirm}
                disabled={loading || pin.length < 4}
                style={{
                  padding: rem(14),
                  borderRadius: rem(10),
                  background: 'var(--rb-accent)',
                  border: '1px solid var(--rb-accent)',
                  textAlign: 'center',
                  color: 'var(--rb-accent-contrast)',
                  fontWeight: 700,
                  opacity: pin.length < 4 ? 0.45 : 1,
                }}
              >
                {t('atm_pin_confirm', 'OK')}
              </UnstyledButton>
            );
          }
          return (
            <UnstyledButton
              key={d}
              type="button"
              onClick={() => append(d)}
              disabled={loading}
              style={{
                padding: rem(14),
                borderRadius: rem(10),
                background: 'var(--rb-surface)',
                border: '1px solid var(--rb-border)',
                textAlign: 'center',
                color: 'var(--rb-text)',
                fontWeight: 700,
                fontSize: rem(18),
              }}
            >
              {d}
            </UnstyledButton>
          );
        })}
      </SimpleGrid>

      <Group justify="center">
        <Button variant="subtle" onClick={onCancel} disabled={loading}>
          {t('cancel', 'Abbrechen')}
        </Button>
      </Group>
    </Card>
  );
}
