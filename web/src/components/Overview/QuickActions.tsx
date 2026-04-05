import { Group, Button, rem } from '@mantine/core';
import {
  IconArrowDownCircle,
  IconArrowUpCircle,
  IconArrowsRightLeft,
} from '@tabler/icons-react';
import type { Account } from '../../types';
import { useBankingStore } from '../../store/bankingStore';

interface QuickActionsProps {
  selectedAccount: Account | null;
  t: (key: string, fallback?: string) => string;
}

export default function QuickActions({ selectedAccount, t }: QuickActionsProps) {
  const openModal = useBankingStore((s) => s.openModal);

  if (!selectedAccount) return null;

  return (
    <Group gap={rem(12)}>
      <Button
        leftSection={<IconArrowDownCircle size={16} />}
        onClick={() => openModal({ type: 'deposit' })}
        variant="light"
        color="teal"
        radius="md"
        style={{ flex: 1 }}
        styles={{
          root: {
            background: 'var(--rb-inflow-muted-bg)',
            border: '1px solid var(--rb-inflow-muted-border)',
            color: 'var(--rb-inflow)',
            '&:hover': { background: 'rgba(52, 211, 153, 0.18)' },
          },
        }}
      >
        {t('deposit_but', 'Einzahlen')}
      </Button>
      <Button
        leftSection={<IconArrowUpCircle size={16} />}
        onClick={() => openModal({ type: 'withdraw' })}
        variant="light"
        color="red"
        radius="md"
        style={{ flex: 1 }}
        styles={{
          root: {
            background: 'rgba(251,113,133,0.1)',
            border: '1px solid rgba(251,113,133,0.2)',
            color: 'var(--rb-danger)',
          },
        }}
      >
        {t('withdraw_but', 'Abheben')}
      </Button>
      <Button
        leftSection={<IconArrowsRightLeft size={16} />}
        onClick={() => openModal({ type: 'transfer' })}
        variant="light"
        radius="md"
        style={{ flex: 1 }}
        styles={{
          root: {
            background: 'var(--rb-surface)',
            border: '1px solid var(--rb-border)',
            color: 'var(--rb-accent)',
          },
        }}
      >
        {t('transfer_but', 'Überweisen')}
      </Button>
    </Group>
  );
}
