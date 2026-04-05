import { useMemo, useState, useEffect } from 'react';
import {
  Card,
  Text,
  Group,
  Box,
  Stack,
  Divider,
  rem,
  Pagination,
} from '@mantine/core';
import type { Account } from '../../types';
import {
  formatMoney,
  formatDate,
  relativeTime,
  displayAccountNumber,
} from '../../lib/formatters';
import { useBankingStore } from '../../store/bankingStore';
import {
  JOURNAL_PAGE_SIZE,
  getPairedTransIds,
  deriveBookingKind,
  paginate,
} from '../../lib/transactionJournal';

interface RecentActivityProps {
  account: Account | null;
  allAccounts: Account[];
  t: (key: string, fallback?: string) => string;
}

export default function RecentActivity({
  account,
  allAccounts,
  t,
}: RecentActivityProps) {
  const currency = useBankingStore((s) => s.currency);
  const locale = useBankingStore((s) => s.locale);
  const [page, setPage] = useState(1);

  const pairedIds = useMemo(
    () => getPairedTransIds(allAccounts),
    [allAccounts],
  );

  const sortedTxs = useMemo(() => {
    if (!account) return [];
    return [...(account.transactions ?? [])].sort(
      (a, b) => (Number(b.time) || 0) - (Number(a.time) || 0),
    );
  }, [account]);

  useEffect(() => {
    setPage(1);
  }, [account?.id]);

  const { slice, total, pageCount, page: activePage } = useMemo(
    () => paginate(sortedTxs, page, JOURNAL_PAGE_SIZE),
    [sortedTxs, page],
  );

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  if (!account) return null;

  const fromRow = total === 0 ? 0 : (activePage - 1) * JOURNAL_PAGE_SIZE + 1;
  const toRow = Math.min(activePage * JOURNAL_PAGE_SIZE, total);

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
            {t('recent_activity_title', 'Letzte Aktivitaet')}
          </Text>
        </Box>
        <Text size="xs" style={{ color: 'var(--rb-text-muted)' }}>
          {displayAccountNumber(account)}
        </Text>
      </Group>

      {total === 0 ? (
        <Text size="sm" style={{ color: 'var(--rb-text-muted)' }} ta="center" py={rem(16)}>
          {t('noTransactions', 'Keine Buchungen gefunden')}
        </Text>
      ) : (
        <>
          <Stack gap={0}>
            {slice.map((tx, i) => {
              const kind = deriveBookingKind(tx, pairedIds);
              const isIn = kind === 'deposit' || kind === 'transfer_in';
              return (
                <Box key={`${tx.trans_id}-${tx.time}-${i}`}>
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
                        {tx.message || tx.title || 'Buchung'}
                      </Text>
                      <Text size="xs" style={{ color: 'var(--rb-text-muted)' }} truncate>
                        {tx.receiver || tx.issuer || '-'}
                      </Text>
                      <Text size="xs" style={{ color: 'var(--rb-text-soft)' }}>
                        {formatDate(tx.time)}
                      </Text>
                    </Box>

                    <Box ta="right" style={{ flexShrink: 0 }}>
                      <Text
                        fw={700}
                        size="sm"
                        className={isIn ? 'amount-in' : 'amount-out'}
                      >
                        {isIn ? '+' : '−'}{formatMoney(tx.amount, currency)}
                      </Text>
                      <Text size="xs" style={{ color: 'var(--rb-text-muted)' }}>
                        {relativeTime(tx.time, locale)}
                      </Text>
                    </Box>
                  </Group>
                  {i < slice.length - 1 && <Divider color="var(--rb-divider)" />}
                </Box>
              );
            })}
          </Stack>

          <Group justify="space-between" align="center" mt={rem(16)} wrap="wrap" gap={rem(12)}>
            <Text size="xs" style={{ color: 'var(--rb-text-muted)' }}>
              {t('journal_rows_range', '{0}–{1} of {2}')
                .replace('{0}', String(fromRow))
                .replace('{1}', String(toRow))
                .replace('{2}', String(total))}
            </Text>
            <Pagination
              total={pageCount}
              value={activePage}
              onChange={setPage}
              size="sm"
              withEdges
              styles={{
                control: {
                  background: 'var(--rb-surface)',
                  borderColor: 'var(--rb-border)',
                  color: 'var(--rb-text)',
                },
              }}
            />
          </Group>
        </>
      )}
    </Card>
  );
}
