import { useCallback, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Box, Button, Stack, Text, Transition, rem } from '@mantine/core';
import { IconArrowBackUp } from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useAccounts, applyBankingServerPayload } from '../hooks/useAccounts';
import { useLocale } from '../hooks/useLocale';
import { useBankingStore } from '../store/bankingStore';
import { postNui } from '../lib/nui';
import type { AtmCardOption } from '../types';

import AtmHero from '../components/ATM/AtmHero';
import AtmKeypad from '../components/ATM/AtmKeypad';
import AtmRecent from '../components/ATM/AtmRecent';
import AtmCardPicker from '../components/ATM/AtmCardPicker';
import AtmPinEntry from '../components/ATM/AtmPinEntry';
import QuickActions from '../components/Overview/QuickActions';

export const Route = createFileRoute('/atm')({
  component: AtmPage,
});

type WizardStep = 'pick' | 'pin';

function AtmPage() {
  const { data: accounts = [] } = useAccounts();
  const atmCards = useBankingStore((s) => s.atmCards);
  const showToast = useBankingStore((s) => s.showToast);
  const selectedAccountId = useBankingStore((s) => s.selectedAccountId);
  const selectedAccount =
    accounts.find((a) => a.id === selectedAccountId) ?? accounts[0] ?? null;
  const { t } = useLocale();
  const queryClient = useQueryClient();

  const [wizardStep, setWizardStep] = useState<WizardStep>('pick');
  const [pinTarget, setPinTarget] = useState<AtmCardOption | null>(null);
  const [pinValue, setPinValue] = useState('');

  const cardCatalogMode = atmCards.length > 0;
  const showMain = accounts.length > 0;

  const onVerifySuccess = useCallback(
    (data: unknown) => {
      applyBankingServerPayload(queryClient, data);
      setWizardStep('pick');
      setPinTarget(null);
      setPinValue('');
    },
    [queryClient],
  );

  const verifyMutation = useMutation({
    mutationFn: async (args: { card: AtmCardOption; pin: string }) => {
      const res = await postNui<unknown>('verifyBankCardPin', {
        accountId: args.card.accountId,
        cardId: args.card.cardId,
        pin: args.pin,
        atm: true,
      });
      return res;
    },
    onSuccess: (data) => {
      if (data === false) {
        showToast(t('bank_card_pin_wrong', 'Falsche PIN.'));
        return;
      }
      onVerifySuccess(data);
    },
  });

  const refreshAtmMutation = useMutation({
    mutationFn: () => postNui<unknown>('refreshAtm', {}),
    onSuccess: (data) => {
      if (data === false) return;
      onVerifySuccess(data);
    },
  });

  function handleSelectCard(card: AtmCardOption) {
    if (card.needsPin) {
      setPinTarget(card);
      setPinValue('');
      setWizardStep('pin');
      return;
    }
    verifyMutation.mutate({ card, pin: '' });
  }

  function handlePinCancel() {
    setPinTarget(null);
    setPinValue('');
    setWizardStep('pick');
  }

  function handlePinConfirm() {
    if (!pinTarget || pinValue.length < 4) return;
    verifyMutation.mutate({ card: pinTarget, pin: pinValue });
  }

  function handleChangeCard() {
    refreshAtmMutation.mutate();
  }

  if (cardCatalogMode && !showMain) {
    if (wizardStep === 'pin' && pinTarget) {
      return (
        <Box
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: rem(24),
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <AtmPinEntry
            card={pinTarget}
            pin={pinValue}
            onPinChange={setPinValue}
            onCancel={handlePinCancel}
            onConfirm={handlePinConfirm}
            loading={verifyMutation.isPending}
            t={t}
          />
        </Box>
      );
    }

    return (
      <Box
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: rem(24),
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <AtmCardPicker cards={atmCards} onSelect={handleSelectCard} t={t} />
      </Box>
    );
  }

  if (!showMain && !cardCatalogMode) {
    return (
      <Box
        style={{
          flex: 1,
          minHeight: 0,
          padding: rem(24),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text ta="center" maw={rem(320)} style={{ color: 'var(--rb-text-muted)' }}>
          {t('atm_no_cards', 'Keine Bankkarte.')}
        </Text>
      </Box>
    );
  }

  return (
    <Box
      style={{
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        overflowX: 'hidden',
        padding: rem(24),
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {cardCatalogMode && showMain ? (
        <Stack gap={rem(12)} mb={rem(8)}>
          <Button
            variant="light"
            size="xs"
            leftSection={<IconArrowBackUp size={16} />}
            onClick={() => handleChangeCard()}
            loading={refreshAtmMutation.isPending}
            style={{ alignSelf: 'flex-start' }}
          >
            {t('atm_change_card', 'Karte wechseln')}
          </Button>
        </Stack>
      ) : null}

      <Transition
        key={selectedAccount?.id ?? 'none'}
        mounted
        transition="fade"
        duration={220}
        timingFunction="cubic-bezier(0.4, 0, 0.2, 1)"
      >
        {(fadeStyles) => (
          <Box
            style={{
              ...fadeStyles,
              display: 'flex',
              flexDirection: 'column',
              gap: rem(20),
            }}
          >
            <AtmHero account={selectedAccount} t={t} />
            <QuickActions selectedAccount={selectedAccount} t={t} />
            <AtmKeypad selectedAccount={selectedAccount} t={t} />
            <AtmRecent account={selectedAccount} t={t} />
          </Box>
        )}
      </Transition>
    </Box>
  );
}
