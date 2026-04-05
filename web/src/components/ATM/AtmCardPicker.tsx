import { Card, Stack, Text, UnstyledButton, rem } from '@mantine/core';
import { IconCreditCard } from '@tabler/icons-react';
import type { AtmCardOption } from '../../types';

interface AtmCardPickerProps {
  cards: AtmCardOption[];
  onSelect: (card: AtmCardOption) => void;
  t: (key: string, fallback?: string) => string;
}

export default function AtmCardPicker({
  cards,
  onSelect,
  t,
}: AtmCardPickerProps) {
  return (
    <Stack gap={rem(16)} align="stretch">
      <div>
        <Text size="xs" c="dimmed" tt="uppercase" fw={600} lts={0.5}>
          {t('atm_select_card', 'Karte einlegen')}
        </Text>
        <Text fw={700} size="lg" style={{ color: 'var(--rb-text)' }}>
          {t('atm_select_card_sub', 'Wähle eine Karte.')}
        </Text>
      </div>
      <Stack gap={rem(10)}>
        {cards.map((card) => (
          <UnstyledButton
            key={`${card.accountId}:${card.cardId}`}
            onClick={() => onSelect(card)}
            style={{
              display: 'block',
              textAlign: 'left',
              padding: rem(16),
              borderRadius: rem(14),
              background: 'var(--rb-card)',
              border: '1px solid var(--rb-border)',
              transition: 'border-color 0.15s, background 0.15s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor =
                'var(--rb-accent)';
              (e.currentTarget as HTMLElement).style.background =
                'var(--rb-fill-raised)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor =
                'var(--rb-border)';
              (e.currentTarget as HTMLElement).style.background = 'var(--rb-card)';
            }}
          >
            <Card
              p={0}
              style={{ background: 'transparent', border: 'none' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: rem(14) }}>
                <IconCreditCard
                  size={28}
                  style={{ color: 'var(--rb-accent)', flexShrink: 0 }}
                />
                <div style={{ minWidth: 0 }}>
                  <Text fw={600} size="sm" truncate style={{ color: 'var(--rb-text)' }}>
                    {card.label || card.accountName}
                  </Text>
                  <Text size="xs" style={{ color: 'var(--rb-text-muted)' }}>
                    {card.accountName}
                    {card.needsPin
                      ? ` · ${t('bank_card_pin_label', 'PIN')}`
                      : ''}
                  </Text>
                </div>
              </div>
            </Card>
          </UnstyledButton>
        ))}
      </Stack>
    </Stack>
  );
}
