import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  Card,
  Text,
  Box,
  Group,
  Badge,
  Table,
  ScrollArea,
  rem,
  Stack,
  TextInput,
  MultiSelect,
  Pagination,
  Popover,
  Button,
  ActionIcon,
  SimpleGrid,
} from '@mantine/core';
import { IconFilter, IconX } from '@tabler/icons-react';
import type { Account } from '../../types';
import {
  JOURNAL_PAGE_SIZE,
  getPairedTransIds,
  deriveBookingKind,
  injectAccountMeta,
  filterTransactions,
  paginate,
  collectCounterpartyOptions,
  type BookingKind,
  type JournalFilters,
} from '../../lib/transactionJournal';
import { formatMoney, formatDate, relativeTime } from '../../lib/formatters';
import { useBankingStore } from '../../store/bankingStore';

const ALL_KINDS: BookingKind[] = [
  'deposit',
  'withdraw',
  'transfer_in',
  'transfer_out',
];

const defaultFilters = (): JournalFilters => ({
  dateFrom: '',
  dateTo: '',
  counterpartyQuery: '',
  counterpartyValues: [],
  textQuery: '',
  kinds: [],
});

interface TransactionTableProps {
  account: Account | null;
  allAccounts: Account[];
  t: (key: string, fallback?: string) => string;
}

function dateInputStyle(minW: number): CSSProperties {
  return {
    flex: '1 1 auto',
    minWidth: rem(minW),
    width: '100%',
    background: 'var(--rb-surface)',
    border: '1px solid var(--rb-border)',
    borderRadius: rem(8),
    color: 'var(--rb-text)',
    padding: `${rem(8)} ${rem(10)}`,
    fontSize: rem(13),
  };
}

function countActiveFilterGroups(f: JournalFilters): number {
  let n = 0;
  if (f.dateFrom || f.dateTo) n += 1;
  if (f.kinds.length > 0) n += 1;
  if (f.counterpartyValues.length > 0 || f.counterpartyQuery.trim()) n += 1;
  if (f.textQuery.trim()) n += 1;
  return n;
}

function periodChipLabel(f: JournalFilters): string {
  if (f.dateFrom && f.dateTo) return `${f.dateFrom} – ${f.dateTo}`;
  if (f.dateFrom) return `${f.dateFrom} – …`;
  if (f.dateTo) return `… – ${f.dateTo}`;
  return '';
}

export default function TransactionTable({
  account,
  allAccounts,
  t,
}: TransactionTableProps) {
  const [filters, setFilters] = useState<JournalFilters>(defaultFilters);
  const [page, setPage] = useState(1);
  const [filterPopoverOpened, setFilterPopoverOpened] = useState(false);
  const currency = useBankingStore((s) => s.currency);
  const locale = useBankingStore((s) => s.locale);

  const pairedIds = useMemo(
    () => getPairedTransIds(allAccounts),
    [allAccounts],
  );

  const baseTxs = useMemo(() => {
    if (!account) return [];
    const raw = injectAccountMeta(account);
    return [...raw].sort(
      (a, b) => (Number(b.time) || 0) - (Number(a.time) || 0),
    );
  }, [account]);

  const counterpartyOptions = useMemo(
    () => collectCounterpartyOptions(baseTxs),
    [baseTxs],
  );

  useEffect(() => {
    setPage(1);
    setFilters(defaultFilters());
  }, [account?.id]);

  const filtered = useMemo(
    () => filterTransactions(baseTxs, filters, pairedIds),
    [baseTxs, filters, pairedIds],
  );

  const { slice, total, pageCount, page: activePage } = useMemo(
    () => paginate(filtered, page, JOURNAL_PAGE_SIZE),
    [filtered, page],
  );

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const kindSelectData = useMemo(
    () =>
      ALL_KINDS.map((k) => ({
        value: k,
        label:
          k === 'deposit'
            ? t('journal_kind_deposit', 'Einzahlung')
            : k === 'withdraw'
              ? t('journal_kind_withdraw', 'Auszahlung')
              : k === 'transfer_in'
                ? t('journal_kind_transfer_in', 'Ueberweisung eingehend')
                : t('journal_kind_transfer_out', 'Ueberweisung ausgehend'),
      })),
    [t],
  );

  const fromRow = total === 0 ? 0 : (activePage - 1) * JOURNAL_PAGE_SIZE + 1;
  const toRow = Math.min(activePage * JOURNAL_PAGE_SIZE, total);

  const activeFilterGroups = countActiveFilterGroups(filters);

  const bumpPage = () => setPage(1);

  const filterFields = (
    <Stack gap={rem(12)}>
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={rem(10)}>
        <Box>
          <Text size="xs" fw={600} mb={rem(4)} style={{ color: 'var(--rb-text-muted)' }}>
            {t('journal_date_from', 'Von (Datum)')}
          </Text>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => {
              setFilters((f) => ({ ...f, dateFrom: e.target.value }));
              bumpPage();
            }}
            style={dateInputStyle(120)}
          />
        </Box>
        <Box>
          <Text size="xs" fw={600} mb={rem(4)} style={{ color: 'var(--rb-text-muted)' }}>
            {t('journal_date_to', 'Bis (Datum)')}
          </Text>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => {
              setFilters((f) => ({ ...f, dateTo: e.target.value }));
              bumpPage();
            }}
            style={dateInputStyle(120)}
          />
        </Box>
      </SimpleGrid>

      <MultiSelect
        label={t('journal_kind_label', 'Buchungstyp')}
        placeholder={t('journal_kind_placeholder', 'Alle Typen')}
        data={kindSelectData}
        value={filters.kinds}
        onChange={(v) => {
          setFilters((f) => ({ ...f, kinds: v as BookingKind[] }));
          bumpPage();
        }}
        size="sm"
        radius="md"
        clearable
        styles={{
          input: {
            background: 'var(--rb-surface)',
            borderColor: 'var(--rb-border)',
            color: 'var(--rb-text)',
          },
          label: { color: 'var(--rb-text-muted)', fontSize: rem(11), fontWeight: 600 },
        }}
      />

      <MultiSelect
        label={t('journal_counterparty_pick', 'Beteiligte (Auswahl)')}
        placeholder={t('journal_counterparty_pick_ph', 'Name oder Konto waehlen')}
        data={counterpartyOptions}
        value={filters.counterpartyValues}
        onChange={(v) => {
          setFilters((f) => ({ ...f, counterpartyValues: v }));
          bumpPage();
        }}
        size="sm"
        radius="md"
        searchable
        clearable
        styles={{
          input: {
            background: 'var(--rb-surface)',
            borderColor: 'var(--rb-border)',
            color: 'var(--rb-text)',
          },
          label: { color: 'var(--rb-text-muted)', fontSize: rem(11), fontWeight: 600 },
        }}
      />

      <TextInput
        label={t('journal_counterparty_text', 'Beteiligte (Freitext)')}
        placeholder={t('journal_counterparty_text_ph', 'In Absender/Empfaenger suchen...')}
        value={filters.counterpartyQuery}
        onChange={(e) => {
          setFilters((f) => ({ ...f, counterpartyQuery: e.currentTarget.value }));
          bumpPage();
        }}
        size="sm"
        radius="md"
        styles={{
          input: {
            background: 'var(--rb-surface)',
            borderColor: 'var(--rb-border)',
            color: 'var(--rb-text)',
          },
          label: { color: 'var(--rb-text-muted)', fontSize: rem(11), fontWeight: 600 },
        }}
      />

      <TextInput
        label={t('journal_text_label', 'Buchungstext')}
        placeholder={t('journal_text_ph', 'Verwendungszweck / Titel...')}
        value={filters.textQuery}
        onChange={(e) => {
          setFilters((f) => ({ ...f, textQuery: e.currentTarget.value }));
          bumpPage();
        }}
        size="sm"
        radius="md"
        styles={{
          input: {
            background: 'var(--rb-surface)',
            borderColor: 'var(--rb-border)',
            color: 'var(--rb-text)',
          },
          label: { color: 'var(--rb-text-muted)', fontSize: rem(11), fontWeight: 600 },
        }}
      />
    </Stack>
  );

  if (!account) {
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
        <Text size="sm" style={{ color: 'var(--rb-text-muted)' }}>
          {t('noAccounts', 'Keine Konten vorhanden')}
        </Text>
      </Card>
    );
  }

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
      <Group
        justify="space-between"
        align="flex-start"
        mb={rem(12)}
        wrap="wrap"
        gap={rem(10)}
      >
        <Box style={{ flex: '1 1 auto', minWidth: rem(200) }}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={600} lts={0.5}>
            {t('allTransactions', 'Buchungsjournal')}
          </Text>
          <Text fw={600} style={{ color: 'var(--rb-text)' }}>
            {account.name}
          </Text>
          <Text size="xs" style={{ color: 'var(--rb-text-muted)' }}>
            {t('journal_scope_hint', 'Nur Buchungen dieses Kontos.')}
          </Text>
        </Box>

        <Group gap={rem(8)} wrap="nowrap">
          <Popover
            width={rem(380)}
            position="bottom-end"
            shadow="md"
            radius="md"
            opened={filterPopoverOpened}
            onChange={setFilterPopoverOpened}
            withinPortal={false}
            trapFocus={false}
            styles={{
              dropdown: {
                background: 'var(--rb-card)',
                border: '1px solid var(--rb-border)',
                zIndex: 200,
              },
            }}
          >
            <Popover.Target>
              <Button
                variant="default"
                size="sm"
                radius="md"
                leftSection={<IconFilter size={16} stroke={1.75} />}
                onClick={() => setFilterPopoverOpened((o) => !o)}
                styles={{
                  root: {
                    background: 'var(--rb-surface)',
                    border: '1px solid var(--rb-border)',
                    color: 'var(--rb-text)',
                  },
                }}
              >
                {t('journal_filter_btn', 'Filter')}
                {activeFilterGroups > 0 ? (
                  <Badge
                    size="xs"
                    variant="filled"
                    color="pink"
                    ml={rem(8)}
                    circle
                    style={{ minWidth: rem(20) }}
                  >
                    {activeFilterGroups}
                  </Badge>
                ) : null}
              </Button>
            </Popover.Target>
            <Popover.Dropdown p={rem(16)}>
              <Text fw={600} size="sm" mb={rem(12)} style={{ color: 'var(--rb-text)' }}>
                {t('journal_filter_title', 'Buchungen filtern')}
              </Text>
              <ScrollArea.Autosize mah={rem(360)} type="auto">
                {filterFields}
              </ScrollArea.Autosize>
              <Button
                fullWidth
                variant="light"
                color="gray"
                size="xs"
                mt={rem(12)}
                disabled={activeFilterGroups === 0}
                onClick={() => {
                  setFilters(defaultFilters());
                  bumpPage();
                }}
              >
                {t('journal_filter_reset_all', 'Alle zuruecksetzen')}
              </Button>
            </Popover.Dropdown>
          </Popover>
        </Group>
      </Group>

      {activeFilterGroups > 0 ? (
        <Group gap={rem(6)} mb={rem(12)} wrap="wrap" align="center">
          <Text size="xs" fw={600} style={{ color: 'var(--rb-text-muted)' }}>
            {t('journal_filter_active_label', 'Aktiv:')}
          </Text>
          {(filters.dateFrom || filters.dateTo) && (
            <Badge
              size="sm"
              variant="light"
              color="pink"
              tt="none"
              style={{ maxWidth: rem(220) }}
              rightSection={
                <ActionIcon
                  size="xs"
                  variant="transparent"
                  color="pink"
                  aria-label={t('journal_filter_remove', 'Entfernen')}
                  onClick={(e) => {
                    e.stopPropagation();
                    setFilters((f) => ({ ...f, dateFrom: '', dateTo: '' }));
                    bumpPage();
                  }}
                >
                  <IconX size={12} stroke={1.75} />
                </ActionIcon>
              }
              styles={{ root: { paddingRight: rem(4) } }}
            >
              {t('journal_filter_chip_period', 'Zeitraum')}: {periodChipLabel(filters)}
            </Badge>
          )}
          {filters.kinds.length > 0 && (
            <Badge
              size="sm"
              variant="light"
              color="pink"
              rightSection={
                <ActionIcon
                  size="xs"
                  variant="transparent"
                  color="pink"
                  aria-label={t('journal_filter_remove', 'Entfernen')}
                  onClick={(e) => {
                    e.stopPropagation();
                    setFilters((f) => ({ ...f, kinds: [] }));
                    bumpPage();
                  }}
                >
                  <IconX size={12} stroke={1.75} />
                </ActionIcon>
              }
              styles={{ root: { paddingRight: rem(4) } }}
            >
              {t('journal_filter_chip_types', 'Typen')}: {filters.kinds.length}
            </Badge>
          )}
          {(filters.counterpartyValues.length > 0 || filters.counterpartyQuery.trim()) && (
            <Badge
              size="sm"
              variant="light"
              color="pink"
              rightSection={
                <ActionIcon
                  size="xs"
                  variant="transparent"
                  color="pink"
                  aria-label={t('journal_filter_remove', 'Entfernen')}
                  onClick={(e) => {
                    e.stopPropagation();
                    setFilters((f) => ({
                      ...f,
                      counterpartyValues: [],
                      counterpartyQuery: '',
                    }));
                    bumpPage();
                  }}
                >
                  <IconX size={12} stroke={1.75} />
                </ActionIcon>
              }
              styles={{ root: { paddingRight: rem(4) } }}
            >
              {t('journal_filter_chip_parties', 'Beteiligte')}
            </Badge>
          )}
          {filters.textQuery.trim() && (
            <Badge
              size="sm"
              variant="light"
              color="pink"
              tt="none"
              style={{ maxWidth: rem(200) }}
              rightSection={
                <ActionIcon
                  size="xs"
                  variant="transparent"
                  color="pink"
                  aria-label={t('journal_filter_remove', 'Entfernen')}
                  onClick={(e) => {
                    e.stopPropagation();
                    setFilters((f) => ({ ...f, textQuery: '' }));
                    bumpPage();
                  }}
                >
                  <IconX size={12} stroke={1.75} />
                </ActionIcon>
              }
              styles={{ root: { paddingRight: rem(4) } }}
            >
              {t('journal_filter_chip_text', 'Text')}:{' '}
              {filters.textQuery.length > 24
                ? `${filters.textQuery.slice(0, 24)}…`
                : filters.textQuery}
            </Badge>
          )}
        </Group>
      ) : null}

      {total === 0 ? (
        <Text size="sm" style={{ color: 'var(--rb-text-muted)' }} ta="center" py={rem(24)}>
          {t('noTransactions', 'Keine Buchungen gefunden')}
        </Text>
      ) : (
        <>
          <ScrollArea>
            <Table
              highlightOnHover
              horizontalSpacing={rem(12)}
              verticalSpacing={rem(8)}
              styles={{
                table: { background: 'transparent' },
                th: {
                  color: 'var(--rb-text-muted)',
                  fontSize: rem(11),
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  borderBottomColor: 'var(--rb-border)',
                },
                td: {
                  color: 'var(--rb-text)',
                  borderBottomColor: 'var(--rb-divider)',
                  verticalAlign: 'top',
                },
                tr: { '&:hover td': { background: 'var(--rb-surface)' } },
              }}
            >
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('date', 'Zeit')}</Table.Th>
                  <Table.Th>{t('messageLabel', 'Buchung')}</Table.Th>
                  <Table.Th>{t('actorLabel', 'Beteiligte')}</Table.Th>
                  <Table.Th>{t('typeLabel', 'Typ')}</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>{t('amountLabel', 'Betrag')}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {slice.map((tx) => {
                  const kind = deriveBookingKind(tx, pairedIds);
                  const isIn = kind === 'deposit' || kind === 'transfer_in';
                  const typeLabel =
                    kind === 'deposit'
                      ? t('deposit_but', 'Einzahlung')
                      : kind === 'withdraw'
                        ? t('withdraw_but', 'Auszahlung')
                        : kind === 'transfer_in'
                          ? t('journal_kind_transfer_in', 'Ueberweisung eingehend')
                          : t('journal_kind_transfer_out', 'Ueberweisung ausgehend');
                  const badgeClass =
                    kind === 'deposit' || kind === 'transfer_in'
                      ? 'tx-badge-in'
                      : 'tx-badge-out';
                  return (
                    <Table.Tr key={`${tx.trans_id}-${tx.time}`}>
                      <Table.Td>
                        <Text size="xs" fw={600}>{formatDate(tx.time)}</Text>
                        <Text size="xs" style={{ color: 'var(--rb-text-muted)' }}>
                          {relativeTime(tx.time, locale)}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" fw={600} truncate style={{ maxWidth: rem(200) }}>
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
                        <Badge size="xs" className={badgeClass} variant="outline">
                          {typeLabel}
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
