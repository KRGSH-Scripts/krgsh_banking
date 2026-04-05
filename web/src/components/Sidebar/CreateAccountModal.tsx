import { useState } from 'react';
import {
  Modal,
  TextInput,
  Button,
  Group,
  Text,
  Stack,
  Box,
  rem,
} from '@mantine/core';
import { useCreateAccount } from '../../hooks/useAccounts';
import { useBankingStore } from '../../store/bankingStore';

interface CreateAccountModalProps {
  opened: boolean;
  onClose: () => void;
  t: (key: string, fallback?: string) => string;
}

export default function CreateAccountModal({
  opened,
  onClose,
  t,
}: CreateAccountModalProps) {
  const [name, setName] = useState('');
  const createAccount = useCreateAccount();
  const showToast = useBankingStore((s) => s.showToast);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const data = await createAccount.mutateAsync(trimmed);
    if (data !== false) {
      setName('');
      onClose();
      showToast(t('create_account_success', 'Konto wurde angelegt.'));
    }
  }

  function handleClose() {
    setName('');
    onClose();
  }

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={
        <Box>
          <Text size="xs" c="dimmed" tt="uppercase" fw={600} lts={0.5}>
            {t('create_account_ui', 'Neues Konto')}
          </Text>
          <Text
            fw={700}
            style={{
              fontFamily: 'var(--mantine-font-family-headings)',
              color: 'var(--rb-text)',
              fontSize: rem(18),
            }}
          >
            {t('create_account', 'Neuen Account erstellen')}
          </Text>
          <Text size="xs" style={{ color: 'var(--rb-text-muted)' }}>
            {t(
              'create_account_ui_hint',
              'Die Kontonummer wird automatisch vergeben.',
            )}
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
      <form onSubmit={handleSubmit}>
        <Stack gap={rem(14)}>
          <TextInput
            label={t('create_account_name_label', 'Kontobezeichnung')}
            placeholder={t(
              'create_account_name_placeholder',
              'z. B. Firmenkasse, Sparbuch',
            )}
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            maxLength={100}
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
          <Group justify="flex-end" mt={rem(4)}>
            <Button variant="default" type="button" onClick={handleClose}>
              {t('cancel', 'Abbrechen')}
            </Button>
            <Button
              type="submit"
              loading={createAccount.isPending}
              style={{
                background: 'var(--rb-accent)',
                color: 'var(--rb-accent-contrast)',
              }}
            >
              {t('create_account_submit', 'Konto anlegen')}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
