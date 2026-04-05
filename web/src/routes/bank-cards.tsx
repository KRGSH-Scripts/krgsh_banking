import { useCallback, useEffect, useMemo, useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import {
  Box,
  Button,
  Card,
  Checkbox,
  Group,
  Modal,
  NumberInput,
  PasswordInput,
  Select,
  Stack,
  Tabs,
  Text,
  TextInput,
  rem,
} from '@mantine/core';
import { IconCreditCard, IconPlus, IconPencil, IconTrash } from '@tabler/icons-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useAccounts, applyBankingServerPayload } from '../hooks/useAccounts';
import { useLocale } from '../hooks/useLocale';
import { useBankingStore } from '../store/bankingStore';
import { postNui } from '../lib/nui';
import type { Account, InventoryBankCardRow } from '../types';

export const Route = createFileRoute('/bank-cards')({
  component: BankCardsPage,
});

function BankCardsPage() {
  const { data: accounts = [] } = useAccounts();
  const visible = useBankingStore((s) => s.visible);
  const atm = useBankingStore((s) => s.atm);
  const showToast = useBankingStore((s) => s.showToast);
  const { t } = useLocale();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [issueOpen, setIssueOpen] = useState(false);
  const [issueAccountId, setIssueAccountId] = useState<string | null>(null);
  const [issuePin, setIssuePin] = useState('');
  const [issueTarget, setIssueTarget] = useState<number | string>('');
  const [issueLoading, setIssueLoading] = useState(false);

  const [editCard, setEditCard] = useState<InventoryBankCardRow | null>(null);
  const [editNickname, setEditNickname] = useState('');
  const [editNewPin, setEditNewPin] = useState('');
  const [editClearPin, setEditClearPin] = useState(false);
  const [editLoading, setEditLoading] = useState(false);

  const [deleteCard, setDeleteCard] = useState<InventoryBankCardRow | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const issueableAccounts = useMemo(
    () => accounts.filter((a) => a.canIssueCard === true),
    [accounts],
  );

  const {
    data: cards = [],
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['bankCards', visible],
    queryFn: async () => {
      const r = await postNui<unknown>('listBankCards', {});
      return Array.isArray(r) ? (r as InventoryBankCardRow[]) : [];
    },
    enabled: visible && !atm,
  });

  useEffect(() => {
    if (visible && !atm) void refetch();
  }, [visible, atm, refetch]);

  const applyBankData = useCallback(
    (raw: unknown) => {
      applyBankingServerPayload(queryClient, raw);
    },
    [queryClient],
  );

  async function handleIssue() {
    if (!issueAccountId) return;
    setIssueLoading(true);
    try {
      const pin =
        typeof issuePin === 'string' && issuePin.trim() !== ''
          ? issuePin.trim()
          : undefined;
      const payload: Record<string, unknown> = {
        accountId: issueAccountId,
        pin,
      };
      if (issueTarget !== '' && issueTarget != null) {
        const n =
          typeof issueTarget === 'number'
            ? issueTarget
            : parseInt(String(issueTarget), 10);
        if (!Number.isNaN(n) && n > 0) payload.targetServerId = n;
      }
      const res = await postNui<unknown>('issueBankCard', payload);
      if (res === false) {
        showToast(t('bank_card_no_access', 'Keine Berechtigung.'));
        return;
      }
      applyBankData(res);
      showToast(t('bank_card_issued', 'Bankkarte ausgestellt.'));
      setIssueOpen(false);
      setIssuePin('');
      void refetch();
    } finally {
      setIssueLoading(false);
    }
  }

  async function handleSaveEdit() {
    if (!editCard) return;
    setEditLoading(true);
    try {
      const payload: Record<string, unknown> = {
        accountId: editCard.accountId,
        cardId: editCard.cardId,
        slot: editCard.slot,
        clearPin: editClearPin,
      };
      if (!editClearPin && editNewPin.trim() !== '') {
        payload.newPin = editNewPin.trim();
      }
      payload.nickname = editNickname;

      const res = await postNui<{ ok?: boolean; bankData?: unknown; error?: string }>(
        'updateBankCard',
        payload,
      );
      if (!res || res.ok !== true) {
        showToast(t('bank_card_update_fail', 'Update fehlgeschlagen.'));
        return;
      }
      if (res.bankData) applyBankData(res.bankData);
      showToast(t('bank_card_updated', 'Karte aktualisiert.'));
      setEditCard(null);
      setEditNewPin('');
      setEditClearPin(false);
      void refetch();
    } finally {
      setEditLoading(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteCard) return;
    setDeleteLoading(true);
    try {
      const res = await postNui<{ ok?: boolean; bankData?: unknown }>(
        'revokeBankCard',
        {
          accountId: deleteCard.accountId,
          cardId: deleteCard.cardId,
          slot: deleteCard.slot,
        },
      );
      if (!res || res.ok !== true) {
        showToast(t('bank_card_revoke_item_fail', 'Entfernen fehlgeschlagen.'));
        return;
      }
      if (res.bankData) applyBankData(res.bankData);
      setDeleteCard(null);
      void refetch();
    } finally {
      setDeleteLoading(false);
    }
  }

  function openEdit(c: InventoryBankCardRow) {
    setEditCard(c);
    setEditNickname(c.label || '');
    setEditNewPin('');
    setEditClearPin(false);
  }

  const issueSelectData = useMemo(
    () =>
      issueableAccounts.map((a: Account) => ({
        value: a.id,
        label: `${a.name || a.id} (${a.type})`,
      })),
    [issueableAccounts],
  );

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
          value="bank-cards"
          onChange={(v) => {
            if (v === 'overview') void navigate({ to: '/overview' });
            if (v === 'transactions') void navigate({ to: '/transactions' });
            if (v === 'schedules') void navigate({ to: '/schedules' });
            if (v === 'bank-cards') void navigate({ to: '/bank-cards' });
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
            {!atm ? (
              <Tabs.Tab value="schedules">{t('pi_nav', 'Zahlungsplaene')}</Tabs.Tab>
            ) : null}
            {!atm ? (
              <Tabs.Tab value="bank-cards">{t('bank_cards_nav', 'Karten')}</Tabs.Tab>
            ) : null}
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
        <Stack gap={rem(20)}>
          <div>
            <Text fw={700} size="lg" style={{ color: 'var(--rb-text)' }}>
              {t('bank_cards_page_title', 'Bankkarten')}
            </Text>
            <Text size="sm" style={{ color: 'var(--rb-text-muted)' }}>
              {t('bank_cards_page_sub', 'Karten in deinem Inventar.')}
            </Text>
          </div>

          {issueableAccounts.length > 0 ? (
            <Button
              leftSection={<IconPlus size={18} />}
              onClick={() => {
                setIssueAccountId(issueableAccounts[0]?.id ?? null);
                setIssueOpen(true);
              }}
              style={{
                alignSelf: 'flex-start',
                background: 'var(--rb-accent)',
                color: 'var(--rb-accent-contrast)',
              }}
            >
              {t('bank_card_issue_open', 'Neue Karte bestellen')}
            </Button>
          ) : null}

          {isFetching && cards.length === 0 ? (
            <Text size="sm" c="dimmed">
              …
            </Text>
          ) : cards.length === 0 ? (
            <Text size="sm" style={{ color: 'var(--rb-text-muted)' }}>
              {t('atm_no_cards', 'Keine Bankkarte im Inventar.')}
            </Text>
          ) : (
            <Stack gap={rem(12)}>
              {cards.map((c) => (
                <Card
                  key={`${String(c.slot)}:${c.accountId}:${c.cardId}`}
                  p={rem(16)}
                  style={{
                    background: 'var(--rb-card)',
                    border: '1px solid var(--rb-border)',
                  }}
                >
                  <Group justify="space-between" wrap="nowrap" align="flex-start">
                    <Group gap={rem(14)} wrap="nowrap">
                      <IconCreditCard
                        size={28}
                        style={{ color: 'var(--rb-accent)', flexShrink: 0 }}
                      />
                      <div style={{ minWidth: 0 }}>
                        <Text fw={600} truncate style={{ color: 'var(--rb-text)' }}>
                          {c.label || c.accountName}
                        </Text>
                        <Text size="xs" style={{ color: 'var(--rb-text-muted)' }}>
                          {c.accountName} ·{' '}
                          {c.kind === 'personal'
                            ? t('bank_card_kind_personal', 'Privat')
                            : t('bank_card_kind_shared', 'Gemeinschaft')}
                          {c.hasPin ? ` · ${t('bank_card_pin_label', 'PIN')}` : ''}
                        </Text>
                        <Text size="xs" c="dimmed" ff="monospace">
                          {c.cardId.length > 14
                            ? `${c.cardId.slice(0, 13)}…`
                            : c.cardId}
                        </Text>
                      </div>
                    </Group>
                    <Group gap={rem(8)} wrap="nowrap">
                      <Button
                        size="xs"
                        variant="light"
                        leftSection={<IconPencil size={14} />}
                        onClick={() => openEdit(c)}
                      >
                        {t('bank_card_edit_title', 'Bearbeiten')}
                      </Button>
                      <Button
                        size="xs"
                        variant="light"
                        color="red"
                        leftSection={<IconTrash size={14} />}
                        onClick={() => setDeleteCard(c)}
                      >
                        {t('bank_card_delete', 'Widerrufen')}
                      </Button>
                    </Group>
                  </Group>
                </Card>
              ))}
            </Stack>
          )}
        </Stack>
      </Box>

      <Modal
        opened={issueOpen}
        onClose={() => setIssueOpen(false)}
        title={t('bank_card_issue_modal_title', 'Bankkarte ausstellen')}
        centered
        styles={{
          content: { background: 'var(--rb-bg-2)', border: '1px solid var(--rb-border)' },
        }}
      >
        <Stack gap={rem(14)}>
          <Select
            label={t('bank_card_issue_pick_account', 'Konto')}
            data={issueSelectData}
            value={issueAccountId}
            onChange={(v) => setIssueAccountId(v)}
            searchable
            styles={{
              input: {
                background: 'var(--rb-surface)',
                border: '1px solid var(--rb-border)',
                color: 'var(--rb-text)',
              },
            }}
          />
          <NumberInput
            label={t('bank_card_target_server_id', 'Server-ID')}
            description={t('bank_card_issue_target_hint', 'Leer = du selbst')}
            min={1}
            value={issueTarget === '' ? undefined : issueTarget}
            onChange={(v) => setIssueTarget(v ?? '')}
            placeholder={t('bank_card_target_optional', 'Optional')}
          />
          <PasswordInput
            label={t('bank_card_pin_optional', 'PIN optional')}
            description={t('bank_card_issue_pin_hint', '')}
            value={issuePin}
            onChange={(e) => setIssuePin(e.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setIssueOpen(false)}>
              {t('cancel', 'Abbrechen')}
            </Button>
            <Button loading={issueLoading} onClick={() => void handleIssue()}>
              {t('confirm', 'Bestätigen')}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={!!editCard}
        onClose={() => setEditCard(null)}
        title={t('bank_card_edit_title', 'Karte bearbeiten')}
        centered
        styles={{
          content: { background: 'var(--rb-bg-2)', border: '1px solid var(--rb-border)' },
        }}
      >
        <Stack gap={rem(14)}>
          <TextInput
            label={t('bank_card_nickname', 'Spitzname')}
            description={t('bank_card_nickname_placeholder', '')}
            value={editNickname}
            onChange={(e) => setEditNickname(e.currentTarget.value)}
          />
          <PasswordInput
            label={t('bank_card_new_pin', 'Neue PIN')}
            value={editNewPin}
            onChange={(e) => setEditNewPin(e.currentTarget.value)}
            disabled={editClearPin}
          />
          <Checkbox
            label={t('bank_card_clear_pin', 'PIN entfernen')}
            checked={editClearPin}
            onChange={(e) => setEditClearPin(e.currentTarget.checked)}
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setEditCard(null)}>
              {t('cancel', 'Abbrechen')}
            </Button>
            <Button loading={editLoading} onClick={() => void handleSaveEdit()}>
              {t('confirm', 'Speichern')}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={!!deleteCard}
        onClose={() => setDeleteCard(null)}
        title={t('bank_card_delete', 'Karte widerrufen')}
        centered
        styles={{
          content: { background: 'var(--rb-bg-2)', border: '1px solid var(--rb-border)' },
        }}
      >
        <Text size="sm" mb={rem(16)} style={{ color: 'var(--rb-text-muted)' }}>
          {t('bank_card_delete_confirm', 'Wirklich widerrufen?')}
        </Text>
        <Group justify="flex-end">
          <Button variant="subtle" onClick={() => setDeleteCard(null)}>
            {t('cancel', 'Abbrechen')}
          </Button>
          <Button
            color="red"
            loading={deleteLoading}
            onClick={() => void handleConfirmDelete()}
          >
            {t('bank_card_delete', 'Widerrufen')}
          </Button>
        </Group>
      </Modal>
    </Box>
  );
}
