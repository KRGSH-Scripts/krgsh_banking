import { useRef } from 'react';
import {
  Modal,
  Stack,
  TextInput,
  Textarea,
  NumberInput,
  Button,
  Group,
  Text,
  Box,
  rem,
} from '@mantine/core';
import { useBankingStore } from '../store/bankingStore';
import { useAccounts } from '../hooks/useAccounts';
import { useDeposit, useWithdraw, useTransfer } from '../hooks/useAccounts';
import { formatMoney, displayAccountNumber } from '../lib/formatters';
import type { TransactionPayload } from '../types';

interface ActionModalProps {
  t: (key: string, fallback?: string) => string;
}

const MODAL_TITLES: Record<string, string> = {
  deposit: 'Einzahlen',
  withdraw: 'Abheben',
  transfer: 'Überweisen',
};

const MODAL_DESCRIPTIONS: Record<string, string> = {
  deposit: 'Bargeld auf das gewählte Konto buchen.',
  withdraw: 'Betrag vom Konto abheben und als Bargeld erhalten.',
  transfer: 'Überweisung an eine Konto-ID oder CitizenID senden.',
};

export default function ActionModal({ t }: ActionModalProps) {
  const modal = useBankingStore((s) => s.modal);
  const closeModal = useBankingStore((s) => s.closeModal);
  const currency = useBankingStore((s) => s.currency);
  const selectedAccountId = useBankingStore((s) => s.selectedAccountId);
  const { data: accounts = [] } = useAccounts();

  const deposit = useDeposit();
  const withdraw = useWithdraw();
  const transfer = useTransfer();

  const selectedAccount =
    accounts.find((a) => a.id === selectedAccountId) ?? accounts[0] ?? null;

  const amountRef = useRef<HTMLInputElement>(null);

  const opened = !!modal;
  const modalType = modal?.type;
  const presetAmount = modal?.presetAmount;

  const isSubmitting =
    deposit.isPending || withdraw.isPending || transfer.isPending;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedAccount || !modalType) return;

    const form = e.currentTarget;
    const data = new FormData(form);
    const amountRaw = Number(data.get('amount'));
    const comment = String(data.get('comment') ?? '').trim();
    const stateid = String(data.get('stateid') ?? '').trim();

    const payload: TransactionPayload = {
      fromAccount: selectedAccount.id,
      amount: Number.isFinite(amountRaw) ? amountRaw : 0,
      comment,
      stateid: modalType === 'transfer' ? stateid : undefined,
    };

    if (modalType === 'deposit') await deposit.mutateAsync(payload);
    else if (modalType === 'withdraw') await withdraw.mutateAsync(payload);
    else if (modalType === 'transfer') await transfer.mutateAsync(payload);
  }

  if (!selectedAccount) return null;

  return (
    <Modal
      opened={opened}
      onClose={closeModal}
      title={
        <Box>
          <Text size="xs" c="dimmed" tt="uppercase" fw={600} lts={0.5}>
            Banking Aktion
          </Text>
          <Text
            fw={700}
            style={{
              fontFamily: 'var(--mantine-font-family-headings)',
              color: 'var(--rb-text)',
              fontSize: rem(18),
            }}
          >
            {t(
              `${modalType ?? 'deposit'}_but`,
              MODAL_TITLES[modalType ?? 'deposit'],
            )}
          </Text>
          <Text size="xs" style={{ color: 'var(--rb-text-muted)' }}>
            {MODAL_DESCRIPTIONS[modalType ?? 'deposit']}
          </Text>
        </Box>
      }
      centered
      radius="lg"
      size="md"
      styles={{
        root: { zIndex: 1000 },
        content: {
          background: 'var(--rb-bg-2)',
          border: '1px solid var(--rb-border)',
        },
        header: {
          background: 'var(--rb-bg-2)',
          borderBottom: '1px solid var(--rb-border)',
          paddingBottom: rem(16),
        },
        close: { color: 'var(--rb-text-muted)' },
      }}
    >
      {/* Account info bar */}
      <Box
        p={rem(12)}
        mb={rem(16)}
        style={{
          background: 'var(--rb-surface)',
          border: '1px solid var(--rb-border)',
          borderRadius: rem(10),
        }}
      >
        <Text size="xs" style={{ color: 'var(--rb-text-muted)' }}>
          {t('accountLabel', 'Konto')}
        </Text>
        <Text fw={600} size="sm" style={{ color: 'var(--rb-text)' }}>
          {selectedAccount.name || selectedAccount.id}
        </Text>
        <Text size="xs" style={{ color: 'var(--rb-text-soft)' }}>
          {displayAccountNumber(selectedAccount)} ·{' '}
          {formatMoney(selectedAccount.amount, currency)}
        </Text>
      </Box>

      <form onSubmit={handleSubmit}>
        <Stack gap={rem(14)}>
          {/* Read-only account field */}
          <TextInput
            label={t('accountLabel', 'Konto')}
            value={`${selectedAccount.name || selectedAccount.id} (${displayAccountNumber(selectedAccount)})`}
            readOnly
            styles={{
              input: {
                background: 'var(--rb-surface)',
                border: '1px solid var(--rb-border)',
                color: 'var(--rb-text-muted)',
              },
              label: { color: 'var(--rb-text-muted)', fontSize: rem(12) },
            }}
          />

          {/* Amount */}
          <NumberInput
            ref={amountRef}
            label={t('amountLabel', 'Betrag')}
            name="amount"
            min={1}
            step={1}
            defaultValue={presetAmount ?? undefined}
            placeholder={t('amountPlaceholder', '0')}
            required
            hideControls={false}
            styles={{
              input: {
                background: 'var(--rb-surface)',
                border: '1px solid var(--rb-border)',
                color: 'var(--rb-text)',
              },
              label: { color: 'var(--rb-text-muted)', fontSize: rem(12) },
            }}
          />

          {/* Transfer target */}
          {modalType === 'transfer' && (
            <TextInput
              label={t('transfer', 'Empfänger / Konto-ID')}
              name="stateid"
              placeholder={t('stateIdPlaceholder', 'CitizenID / Konto-ID')}
              required
              styles={{
                input: {
                  background: 'var(--rb-surface)',
                  border: '1px solid var(--rb-border)',
                  color: 'var(--rb-text)',
                },
                label: { color: 'var(--rb-text-muted)', fontSize: rem(12) },
              }}
            />
          )}

          {/* Comment */}
          <Textarea
            label={t('commentLabel', 'Verwendungszweck')}
            name="comment"
            placeholder={t('commentPlaceholder', 'Optionaler Verwendungszweck')}
            rows={2}
            styles={{
              input: {
                background: 'var(--rb-surface)',
                border: '1px solid var(--rb-border)',
                color: 'var(--rb-text)',
              },
              label: { color: 'var(--rb-text-muted)', fontSize: rem(12) },
            }}
          />

          {/* Actions */}
          <Group justify="flex-end" mt={rem(4)}>
            <Button
              variant="subtle"
              onClick={closeModal}
              style={{ color: 'var(--rb-text-muted)' }}
              disabled={isSubmitting}
            >
              {t('cancel', 'Abbrechen')}
            </Button>
            <Button
              type="submit"
              loading={isSubmitting}
              style={{
                background: 'var(--rb-accent)',
                color: 'var(--rb-accent-contrast)',
              }}
            >
              {t('confirm', 'Bestätigen')}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
