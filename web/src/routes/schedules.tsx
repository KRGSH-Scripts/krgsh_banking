import { createFileRoute, useNavigate } from '@tanstack/react-router';
import {
  Box,
  Stack,
  Tabs,
  rem,
  Paper,
  Text,
  Group,
  Button,
  Badge,
  Select,
  TextInput,
  NumberInput,
  Modal,
  SimpleGrid,
} from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { useCallback, useEffect, useState } from 'react';

import { useAccounts } from '../hooks/useAccounts';
import { useLocale } from '../hooks/useLocale';
import { useBankingStore } from '../store/bankingStore';
import { postNui, isNuiRuntime } from '../lib/nui';
import { formatMoney } from '../lib/formatters';
import type { PaymentInstruction } from '../types';

export const Route = createFileRoute('/schedules')({
  component: SchedulesPage,
});

const INTERVAL_PRESETS = [
  { value: '86400', labelKey: 'pi_interval_daily' },
  { value: '604800', labelKey: 'pi_interval_weekly' },
  { value: '2592000', labelKey: 'pi_interval_monthly' },
] as const;

function kindLabel(kind: string, t: (k: string, fb?: string) => string): string {
  switch (kind) {
    case 'standing_order':
      return t('pi_kind_standing', 'Dauerauftrag');
    case 'direct_debit':
      return t('pi_kind_debit', 'Lastschrift');
    case 'installment':
      return t('pi_kind_installment', 'Ratenzahlung');
    case 'subscription':
      return t('pi_kind_subscription', 'Abo');
    default:
      return kind;
  }
}

function intervalHuman(sec: number, t: (k: string, fb?: string) => string): string {
  if (sec < 1) return t('pi_manual_debit', 'manual / API');
  if (sec === 86400) return t('pi_interval_daily', 'Daily');
  if (sec === 604800) return t('pi_interval_weekly', 'Weekly');
  if (sec === 2592000) return t('pi_interval_monthly', 'Monthly (30 days)');
  return `${sec}s`;
}

function statusLabel(status: string, t: (k: string, fb?: string) => string): string {
  switch (status) {
    case 'active':
      return t('pi_status_active', 'Aktiv');
    case 'paused':
      return t('pi_status_paused', 'Pausiert');
    case 'pending_debtor_confirm':
      return t('pi_status_pending', 'Bestaetigung ausstehend');
    case 'cancelled':
      return t('pi_status_cancelled', 'Gekuendigt');
    case 'completed':
      return t('pi_status_completed', 'Abgeschlossen');
    case 'declined':
      return t('pi_status_declined', 'Abgelehnt');
    default:
      return status;
  }
}

function SchedulesPage() {
  const { data: accounts = [] } = useAccounts();
  const atm = useBankingStore((s) => s.atm);
  const currency = useBankingStore((s) => s.currency);
  const localeTag = typeof navigator !== 'undefined' ? navigator.language : 'de-DE';
  const { t } = useLocale();
  const navigate = useNavigate();

  const [items, setItems] = useState<PaymentInstruction[]>([]);
  const [loading, setLoading] = useState(false);
  const [debtorId, setDebtorId] = useState<string | null>(null);
  const [creditor, setCreditor] = useState('');
  const [amount, setAmount] = useState<number | string>('');
  const [intervalSec, setIntervalSec] = useState<string | null>('86400');
  const [label, setLabel] = useState('');
  const [newOrderOpen, setNewOrderOpen] = useState(false);

  const refresh = useCallback(async () => {
    if (!isNuiRuntime()) {
      setItems([]);
      return;
    }
    setLoading(true);
    const list = await postNui<PaymentInstruction[]>('listPaymentInstructions', { atm });
    setLoading(false);
    setItems(Array.isArray(list) ? list : []);
  }, [atm]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!debtorId && accounts[0]) setDebtorId(accounts[0].id);
  }, [accounts, debtorId]);

  useEffect(() => {
    if (newOrderOpen && !debtorId && accounts[0]) setDebtorId(accounts[0].id);
  }, [newOrderOpen, accounts, debtorId]);

  const intervalOptions = INTERVAL_PRESETS.map((p) => ({
    value: p.value,
    label: t(p.labelKey, p.value),
  }));

  async function createOrder() {
    const amt = typeof amount === 'number' ? amount : parseInt(String(amount), 10);
    const res = await postNui<{ success?: boolean; error?: string }>('createStandingOrder', {
      atm,
      debtorAccountId: debtorId,
      creditorTarget: creditor.trim(),
      amount: amt,
      intervalSeconds: parseInt(intervalSec ?? '0', 10),
      label: label.trim(),
    });
    if (res && typeof res === 'object' && res.success) {
      useBankingStore.getState().showToast(t('pi_created_ok', 'Dauerauftrag angelegt.'));
      setCreditor('');
      setAmount('');
      setLabel('');
      setNewOrderOpen(false);
      void refresh();
    } else {
      const code = res && typeof res === 'object' ? res.error : undefined;
      const detail =
        code === 'db'
          ? t('pi_error_db', 'Datenbankfehler — Server-Log pruefen.')
          : code === 'auth'
            ? t('pi_error_auth', 'Keine Berechtigung fuer dieses Konto.')
            : code === 'invalid'
              ? t('pi_error_invalid', 'Ungueltige Eingaben (Betrag, Intervall >= 60s, Ziel).')
              : t('pi_created_fail', 'Konnte nicht anlegen.');
      useBankingStore.getState().showToast(detail);
    }
  }

  async function doUpdate(id: string, action: 'pause' | 'resume' | 'cancel') {
    const res = await postNui<{ success?: boolean }>('updatePaymentInstruction', { atm, id, action });
    if (res && typeof res === 'object' && res.success) void refresh();
    else useBankingStore.getState().showToast(t('pi_action_fail', 'Aktion fehlgeschlagen.'));
  }

  async function doMandate(id: string, accept: boolean) {
    const res = await postNui<{ success?: boolean }>('respondMandate', { atm, id, accept });
    if (res && typeof res === 'object' && res.success) void refresh();
    else useBankingStore.getState().showToast(t('pi_action_fail', 'Aktion fehlgeschlagen.'));
  }

  if (atm) {
    return (
      <Stack gap={rem(16)} p={rem(24)}>
        <Text c="dimmed">{t('pi_atm_blocked', 'Am Geldautomat nicht verfuegbar.')}</Text>
        <Button variant="light" onClick={() => void navigate({ to: '/overview' })}>
          {t('dashboard', 'Kontouebersicht')}
        </Button>
      </Stack>
    );
  }

  return (
    <Box
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Box
        style={{
          flexShrink: 0,
          paddingLeft: rem(24),
          paddingRight: rem(24),
          paddingTop: rem(24),
        }}
      >
        <Tabs
          value="schedules"
          onChange={(v) => {
            if (v === 'overview') void navigate({ to: '/overview' });
            if (v === 'transactions') void navigate({ to: '/transactions' });
          }}
          mb={rem(20)}
          styles={{
            tab: {
              color: 'var(--rb-text-muted)',
              '&[data-active]': {
                color: 'var(--rb-accent)',
                borderBottomColor: 'var(--rb-accent)',
              },
            },
            list: { borderBottomColor: 'var(--rb-border)' },
          }}
        >
          <Tabs.List>
            <Tabs.Tab value="overview">{t('dashboard', 'Kontouebersicht')}</Tabs.Tab>
            <Tabs.Tab value="transactions">{t('transactionLog', 'Buchungen')}</Tabs.Tab>
            <Tabs.Tab value="schedules">{t('pi_nav', 'Zahlungsplaene')}</Tabs.Tab>
          </Tabs.List>
        </Tabs>
      </Box>

      <Box
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          paddingLeft: rem(24),
          paddingRight: rem(24),
          paddingBottom: rem(24),
          WebkitOverflowScrolling: 'touch',
        }}
      >
      <Group justify="space-between" align="flex-start" wrap="wrap" gap={rem(12)} mb={rem(16)}>
        <Box style={{ flex: '1 1 200px', minWidth: 0 }}>
          <Text fw={700} size="lg" mb={rem(6)} style={{ fontFamily: 'var(--mantine-font-family-headings)' }}>
            {t('pi_title', 'Dauerauftraege & Lastschriften')}
          </Text>
          <Text size="sm" c="dimmed">
            {t('pi_subtitle', 'Dauerauftraege anlegen, Mandate bestaetigen, Abos verwalten.')}
          </Text>
        </Box>
        <Button
          leftSection={<IconPlus size={18} stroke={2} />}
          onClick={() => setNewOrderOpen(true)}
          style={{
            background: 'var(--rb-accent)',
            color: 'var(--rb-accent-contrast)',
            flexShrink: 0,
          }}
        >
          {t('pi_new_standing_btn', 'Neuer Dauerauftrag')}
        </Button>
      </Group>

      <Modal
        opened={newOrderOpen}
        onClose={() => setNewOrderOpen(false)}
        title={t('pi_new_standing', 'Neuer Dauerauftrag')}
        centered
        overlayProps={{ backgroundOpacity: 0.55, blur: 4 }}
        styles={{
          content: {
            background: 'var(--rb-card)',
            border: '1px solid var(--rb-border)',
          },
          header: {
            background: 'var(--rb-bg-2)',
            borderBottom: '1px solid var(--rb-border)',
          },
          title: {
            fontWeight: 700,
            fontFamily: 'var(--mantine-font-family-headings)',
            color: 'var(--rb-text)',
          },
          body: { paddingTop: rem(16) },
        }}
      >
        <Stack gap={rem(14)}>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={rem(12)}>
            <Select
              label={t('pi_from_account', 'Abbuchungskonto')}
              data={accounts.map((a) => ({ value: a.id, label: `${a.name} (${a.id})` }))}
              value={debtorId}
              onChange={setDebtorId}
              styles={{ input: { background: 'var(--rb-surface)', borderColor: 'var(--rb-border)' } }}
            />
            <TextInput
              label={t('pi_creditor', 'Ziel (CitizenID / Konto-ID)')}
              value={creditor}
              onChange={(e) => setCreditor(e.currentTarget.value)}
              styles={{ input: { background: 'var(--rb-surface)', borderColor: 'var(--rb-border)' } }}
            />
            <NumberInput
              label={t('amount', 'Betrag')}
              value={amount}
              onChange={setAmount}
              min={1}
              styles={{ input: { background: 'var(--rb-surface)', borderColor: 'var(--rb-border)' } }}
            />
            <Select
              label={t('pi_interval', 'Intervall')}
              data={intervalOptions}
              value={intervalSec}
              onChange={setIntervalSec}
              styles={{ input: { background: 'var(--rb-surface)', borderColor: 'var(--rb-border)' } }}
            />
            <TextInput
              label={t('pi_label', 'Bezeichnung (optional)')}
              value={label}
              onChange={(e) => setLabel(e.currentTarget.value)}
              style={{ gridColumn: '1 / -1' }}
              styles={{ input: { background: 'var(--rb-surface)', borderColor: 'var(--rb-border)' } }}
            />
          </SimpleGrid>
          <Group justify="flex-end" gap={rem(10)} mt={rem(4)}>
            <Button variant="default" onClick={() => setNewOrderOpen(false)}>
              {t('cancel', 'Abbrechen')}
            </Button>
            <Button
              onClick={() => void createOrder()}
              style={{ background: 'var(--rb-accent)', color: 'var(--rb-accent-contrast)' }}
            >
              {t('pi_create_submit', 'Dauerauftrag speichern')}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Text fw={600} mb={rem(12)}>
        {t('pi_list_title', 'Uebersicht')} {loading ? '…' : `(${items.length})`}
      </Text>

      <Stack gap={rem(12)}>
        {items.length === 0 ? (
          <Text c="dimmed" size="sm">
            {t('pi_empty', 'Keine Eintraege.')}
          </Text>
        ) : (
          items.map((row) => (
            <Paper
              key={row.id}
              p={rem(16)}
              radius="md"
              style={{ background: 'var(--rb-card)', border: '1px solid var(--rb-border)' }}
            >
              <Group justify="space-between" align="flex-start" wrap="nowrap">
                <Stack gap={rem(4)} style={{ minWidth: 0 }}>
                  <Group gap={rem(8)} wrap="wrap">
                    <Badge variant="light" color="gray">
                      {kindLabel(row.kind, t)}
                    </Badge>
                    <Badge
                      variant="dot"
                      color={
                        row.status === 'active'
                          ? 'teal'
                          : row.status === 'pending_debtor_confirm'
                            ? 'yellow'
                            : row.status === 'paused'
                              ? 'orange'
                              : 'gray'
                      }
                    >
                      {statusLabel(row.status, t)}
                    </Badge>
                    {row.kind === 'subscription' && row.metadata?.system_suspended ? (
                      <Badge color="red" variant="outline">
                        {t('pi_system_suspended', 'Ausgesetzt (System)')}
                      </Badge>
                    ) : null}
                  </Group>
                  <Text size="sm" style={{ color: 'var(--rb-text-muted)' }}>
                    {t('pi_row_from', 'Von')}: {row.debtor_account_id} → {t('pi_row_to', 'Nach')}: {row.creditor_target}
                  </Text>
                  <Text size="sm" fw={600}>
                    {formatMoney(row.amount, currency)}
                    {' · '}
                    {intervalHuman(row.interval_seconds, t)}
                  </Text>
                  {typeof row.metadata?.remaining_principal === 'number' ? (
                    <Text size="xs" c="dimmed">
                      {t('pi_remaining', 'Restschuld')}: {formatMoney(row.metadata.remaining_principal, currency)}
                    </Text>
                  ) : null}
                  {typeof row.metadata?.label === 'string' && row.metadata.label ? (
                    <Text size="xs" c="dimmed">
                      {row.metadata.label}
                    </Text>
                  ) : null}
                  <Text size="xs" c="dimmed">
                    {t('pi_next', 'Naechste Ausfuehrung')}:{' '}
                    {row.next_run_at > 0
                      ? new Date(row.next_run_at * 1000).toLocaleString(localeTag)
                      : '—'}
                  </Text>
                </Stack>
                <Group gap={rem(6)} wrap="wrap" justify="flex-end">
                  {row.status === 'pending_debtor_confirm' ? (
                    <>
                      <Button size="xs" color="teal" variant="light" onClick={() => void doMandate(row.id, true)}>
                        {t('pi_accept', 'Zustimmen')}
                      </Button>
                      <Button size="xs" color="red" variant="light" onClick={() => void doMandate(row.id, false)}>
                        {t('pi_decline', 'Ablehnen')}
                      </Button>
                    </>
                  ) : null}
                  {row.status === 'active' ? (
                    <Button size="xs" variant="light" onClick={() => void doUpdate(row.id, 'pause')}>
                      {t('pi_pause', 'Pausieren')}
                    </Button>
                  ) : null}
                  {row.status === 'paused' ? (
                    <Button size="xs" variant="light" onClick={() => void doUpdate(row.id, 'resume')}>
                      {t('pi_resume', 'Fortsetzen')}
                    </Button>
                  ) : null}
                  {row.status === 'active' || row.status === 'paused' ? (
                    <Button size="xs" color="red" variant="subtle" onClick={() => void doUpdate(row.id, 'cancel')}>
                      {t('pi_cancel', 'Loeschen / Kuendigen')}
                    </Button>
                  ) : null}
                </Group>
              </Group>
            </Paper>
          ))
        )}
      </Stack>
      </Box>
    </Box>
  );
}
