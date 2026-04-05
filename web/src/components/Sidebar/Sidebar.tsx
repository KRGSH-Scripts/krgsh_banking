import { useState } from 'react';
import { Stack, Box, Text, Group, Divider, rem, ActionIcon, Tooltip } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import type { Account } from '../../types';
import { useBankingStore } from '../../store/bankingStore';
import {
  formatMoney,
  sumAccountBalances,
  getCashBalance,
} from '../../lib/formatters';
import AccountCard from './AccountCard';
import CreateAccountModal from './CreateAccountModal';

interface SidebarProps {
  accounts: Account[];
  t: (key: string, fallback?: string) => string;
}

export default function Sidebar({ accounts, t }: SidebarProps) {
  const currency = useBankingStore((s) => s.currency);
  const locale = useBankingStore((s) => s.locale);
  const atm = useBankingStore((s) => s.atm);
  const canCreateAccounts = useBankingStore((s) => s.canCreateAccounts);
  const setSelectedAccountId = useBankingStore((s) => s.setSelectedAccountId);
  const selectedAccountId = useBankingStore((s) => s.selectedAccountId);
  const [createOpen, setCreateOpen] = useState(false);

  const totalBalance = sumAccountBalances(accounts);
  const cashBalance = getCashBalance(accounts);

  const fmt = (v: number) => formatMoney(v, currency);

  return (
    <Stack gap={0} style={{ height: '100%' }}>
      {/* Header block */}
      <Box
        p={rem(20)}
        style={{ borderBottom: '1px solid var(--rb-border)' }}
      >
        <Text size="xs" c="dimmed" tt="uppercase" fw={600} lts={1} mb={rem(4)}>
          {t('portfolio', 'Konten')}
        </Text>

        <Group gap={rem(20)} mt={rem(12)}>
          <Box>
            <Text size="xs" style={{ color: 'var(--rb-text-muted)' }}>
              {t('totalBalance', 'Gesamtguthaben')}
            </Text>
            <Text
              fw={700}
              style={{
                color: 'var(--rb-accent)',
                fontFamily: 'var(--mantine-font-family-headings)',
                fontSize: rem(18),
              }}
            >
              {fmt(totalBalance)}
            </Text>
          </Box>
          <Box>
            <Text size="xs" style={{ color: 'var(--rb-text-muted)' }}>
              {t('cash', 'Bargeld')}
            </Text>
            <Text fw={600} style={{ color: 'var(--rb-inflow)', fontSize: rem(15) }}>
              {fmt(cashBalance)}
            </Text>
          </Box>
        </Group>
      </Box>

      <Divider color="var(--rb-divider)" />

      {/* Account count */}
      <Box px={rem(20)} pt={rem(18)} pb={rem(10)}>
        <Group justify="space-between" wrap="nowrap">
          <Text size="xs" c="dimmed" tt="uppercase" fw={600} lts={1}>
            {t('accountCount', 'Konten')} ({accounts.length})
          </Text>
          <Group gap={rem(6)} wrap="nowrap">
            {canCreateAccounts && !atm && (
              <Tooltip label={t('create_account_ui', 'Neues Konto')}>
                <ActionIcon
                  variant="light"
                  color="pink"
                  radius="xl"
                  size="sm"
                  aria-label={t('create_account_ui', 'Neues Konto')}
                  onClick={() => setCreateOpen(true)}
                  style={{
                    border: '1px solid var(--rb-border)',
                    background: 'var(--rb-surface)',
                    color: 'var(--rb-accent)',
                  }}
                >
                  <IconPlus size={16} stroke={2} />
                </ActionIcon>
              </Tooltip>
            )}
            <Text size="xs" style={{ color: 'var(--rb-text-muted)' }}>
              {t('select_account', 'Konto wählen')}
            </Text>
          </Group>
        </Group>
      </Box>

      <CreateAccountModal
        opened={createOpen}
        onClose={() => setCreateOpen(false)}
        t={t}
      />

      {/* Account list */}
      <Stack gap={rem(14)} px={rem(14)} pb={rem(16)} style={{ flex: 1, overflowY: 'auto' }}>
        {accounts.length === 0 ? (
          <Box p={rem(16)} ta="center">
            <Text size="sm" style={{ color: 'var(--rb-text-muted)' }}>
              {t('noAccounts', 'Keine Konten vorhanden')}
            </Text>
          </Box>
        ) : (
          accounts.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              selected={account.id === selectedAccountId}
              onClick={() => setSelectedAccountId(account.id)}
              t={t}
              currency={currency}
              locale={locale}
            />
          ))
        )}
      </Stack>
    </Stack>
  );
}
