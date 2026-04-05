import { useState, useMemo } from 'react';
import {
  Card,
  TextInput,
  Text,
  Box,
  Group,
  Badge,
  Table,
  ScrollArea,
  rem,
} from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import type { Account } from '../../types';
import { getAllTransactions } from '../../lib/nui';
import { formatMoney, formatDate, relativeTime } from '../../lib/formatters';
import { useBankingStore } from '../../store/bankingStore';

interface TransactionTableProps {
  accounts: Account[];
  t: (key: string, fallback?: string) => string;
}

export default function TransactionTable({ accounts, t }: TransactionTableProps) {
  const [search, setSearch] = useState('');
  const currency = useBankingStore((s) => s.currency);
  const locale = useBankingStore((s) => s.locale);

  const allTx = useMemo(() => getAllTransactions(accounts), [accounts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allTx;
    return allTx.filter((tx) => {
      const hay = [
        tx.title,
        tx.trans_id,
        tx.receiver,
        tx.message,
        tx.issuer,
        tx.__accountId,
        tx.__accountName,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [allTx, search]);

  return (
    <Card
      p={rem(20)}
      style={{
        background: 'var(--rb-card)',
        border: '1px solid var(--rb-border)',
        borderRadius: rem(16),
        flex: 1,
      }}
    >
      {/* Header */}
      <Group justify="space-between" align="flex-end" mb={rem(16)} wrap="wrap" gap={rem(12)}>
        <Box>
          <Text size="xs" c="dimmed" tt="uppercase" fw={600} lts={0.5}>
            {t('allTransactions', 'Buchungsjournal')}
          </Text>
          <Text fw={600} style={{ color: 'var(--rb-text)' }}>
            Kontojournal
          </Text>
          <Text size="xs" style={{ color: 'var(--rb-text-muted)' }}>
            Suche in Nachricht, Trans-ID, Empfänger oder Konto-ID.
          </Text>
        </Box>
        <TextInput
          placeholder={t('trans_search', 'Buchung suchen...')}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          leftSection={<IconSearch size={14} />}
          size="sm"
          radius="md"
          styles={{
            input: {
              background: 'var(--rb-surface)',
              border: '1px solid var(--rb-border)',
              color: 'var(--rb-text)',
              minWidth: rem(280),
              '&::placeholder': { color: 'var(--rb-text-muted)' },
            },
          }}
        />
      </Group>

      {filtered.length === 0 ? (
        <Text size="sm" style={{ color: 'var(--rb-text-muted)' }} ta="center" py={rem(24)}>
          {t('noTransactions', 'Keine Buchungen gefunden')}
        </Text>
      ) : (
        <ScrollArea>
          <Table
            highlightOnHover
            horizontalSpacing={rem(12)}
            verticalSpacing={rem(8)}
            styles={{
              table: { background: 'transparent' },
              th: { color: 'var(--rb-text-muted)', fontSize: rem(11), textTransform: 'uppercase', letterSpacing: 0.5, borderBottomColor: 'var(--rb-border)' },
              td: { color: 'var(--rb-text)', borderBottomColor: 'var(--rb-divider)', verticalAlign: 'top' },
              tr: { '&:hover td': { background: 'var(--rb-surface)' } },
            }}
          >
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('date', 'Zeit')}</Table.Th>
                <Table.Th>{t('accountLabel', 'Konto')}</Table.Th>
                <Table.Th>{t('messageLabel', 'Buchung')}</Table.Th>
                <Table.Th>{t('actorLabel', 'Beteiligte')}</Table.Th>
                <Table.Th>{t('typeLabel', 'Typ')}</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>{t('amountLabel', 'Betrag')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filtered.map((tx) => {
                const isIn = (tx.trans_type ?? '').toLowerCase() === 'deposit';
                return (
                  <Table.Tr key={tx.trans_id}>
                    <Table.Td>
                      <Text size="xs" fw={600}>{formatDate(tx.time)}</Text>
                      <Text size="xs" style={{ color: 'var(--rb-text-muted)' }}>
                        {relativeTime(tx.time, locale)}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" fw={600} truncate style={{ maxWidth: rem(120) }}>
                        {tx.__accountName || tx.title || tx.__accountId || '-'}
                      </Text>
                      <Text size="xs" style={{ color: 'var(--rb-text-muted)' }}>
                        {tx.__accountId || '-'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" fw={600} truncate style={{ maxWidth: rem(160) }}>
                        {tx.message || tx.title || '-'}
                      </Text>
                      <Text size="xs" style={{ color: 'var(--rb-text-muted)' }}>
                        {tx.trans_id}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs">{tx.issuer || '-'}</Text>
                      <Text size="xs" style={{ color: 'var(--rb-text-muted)' }}>
                        {tx.receiver || '-'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        size="xs"
                        className={isIn ? 'tx-badge-in' : 'tx-badge-out'}
                        variant="outline"
                      >
                        {isIn
                          ? t('deposit_but', 'Einzahlung')
                          : t('withdraw_but', 'Auszahlung')}
                      </Badge>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      <Text
                        size="sm"
                        fw={700}
                        className={isIn ? 'amount-in' : 'amount-out'}
                      >
                        {isIn ? '+' : '−'}{formatMoney(tx.amount, currency)}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      )}
    </Card>
  );
}
