import {
  Group,
  Box,
  Text,
  Image,
  ActionIcon,
  Badge,
  rem,
} from '@mantine/core';
import { IconX } from '@tabler/icons-react';
import type { BankTheme } from '../types';

interface TopBarProps {
  theme: BankTheme;
  atm: boolean;
  onClose: () => void;
  t: (key: string, fallback?: string) => string;
}

export default function TopBar({ theme, atm, onClose, t }: TopBarProps) {
  const logoVisible = !!(theme.logo && String(theme.logo).trim());
  const logoFallback = ((theme.name || 'BANK')
    .replace(/[^A-Za-z0-9]/g, '')
    .slice(0, 3) || 'BNK'
  ).toUpperCase();

  return (
    <Group
      h="100%"
      px={rem(20)}
      justify="space-between"
      style={{ borderBottom: '1px solid var(--rb-border)' }}
    >
      {/* Brand */}
      <Group gap={rem(12)}>
        <Box
          style={{
            width: rem(36),
            height: rem(36),
            borderRadius: rem(8),
            background: 'var(--rb-surface)',
            border: '1px solid var(--rb-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          {logoVisible ? (
            <Image src={theme.logo} alt="" w={rem(28)} h={rem(28)} fit="contain" />
          ) : (
            <Text
              size="xs"
              fw={700}
              style={{ color: 'var(--rb-accent)', fontFamily: 'var(--mantine-font-family-headings)' }}
            >
              {logoFallback}
            </Text>
          )}
        </Box>
        <Box>
          <Text
            size="xs"
            style={{ color: 'var(--rb-text-muted)' }}
            tt="uppercase"
            fw={600}
            lts={1}
          >
            {atm ? t('modeAtm', 'Geldautomat') : theme.contextLabel || t('modeBank', 'Bank')}
          </Text>
          <Text
            size="sm"
            fw={700}
            style={{
              color: 'var(--rb-text)',
              fontFamily: 'var(--mantine-font-family-headings)',
              lineHeight: 1.2,
            }}
          >
            {theme.name || t('bank_name', 'Los Santos Banking')}
          </Text>
          <Text size="xs" style={{ color: 'var(--rb-text-muted)' }}>
            {theme.subtitle || t('homebanking', 'Homebanking')}
            {theme.location ? ` · ${theme.location}` : ''}
          </Text>
        </Box>
      </Group>

      {/* Right side */}
      <Group gap={rem(12)}>
        <Badge
          variant="dot"
          color={atm ? 'orange' : 'teal'}
          style={{
            background: 'var(--rb-surface)',
            border: '1px solid var(--rb-border)',
            color: 'var(--rb-text-muted)',
          }}
        >
          {atm ? t('modeAtm', 'Geldautomat') : t('modeBank', 'Bank')}
        </Badge>
        <ActionIcon
          variant="subtle"
          onClick={onClose}
          size="lg"
          radius="md"
          style={{ color: 'var(--rb-text-muted)' }}
          aria-label={t('close', 'Schließen')}
        >
          <IconX size={18} />
        </ActionIcon>
      </Group>
    </Group>
  );
}
