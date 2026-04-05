import {
  createRootRouteWithContext,
  Outlet,
  useRouterState,
} from '@tanstack/react-router';
import type { QueryClient } from '@tanstack/react-query';
import {
  AppShell,
  Box,
  Loader,
  Notification,
  Portal,
  Stack,
  Text,
  rem,
  Transition,
} from '@mantine/core';
import { useEffect } from 'react';

import { useNuiMessage } from '../hooks/useNuiMessage';
import { useBankingStore } from '../store/bankingStore';
import { useAccounts } from '../hooks/useAccounts';
import { useLocale } from '../hooks/useLocale';
import { isNuiRuntime, postNui } from '../lib/nui';
import { applyThemeCssVars } from '../lib/theme';
import { DEFAULT_THEME } from '../lib/theme';

import Sidebar from '../components/Sidebar/Sidebar';
import TopBar from '../components/TopBar';
import ActionModal from '../components/ActionModal';

interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
});

function RoutedOutlet() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <Transition
      key={pathname}
      mounted
      transition="fade"
      duration={260}
      timingFunction="cubic-bezier(0.4, 0, 0.2, 1)"
    >
      {(styles) => (
        <Box
          style={{
            ...styles,
            minHeight: '100%',
            position: 'relative',
          }}
        >
          <Outlet />
        </Box>
      )}
    </Transition>
  );
}

function RootLayout() {
  // Apply default theme CSS vars on first render
  useEffect(() => {
    applyThemeCssVars(DEFAULT_THEME);
  }, []);

  // Start NUI message listener
  useNuiMessage();

  // Boot preview data nur im Vite-Browser — in der NUI existiert GetParentResourceName(),
  // invokeNative dagegen oft nicht; sonst bliebe die Demo-UI dauerhaft sichtbar (schwarzer Vollbild-Layer).
  useEffect(() => {
    if (isNuiRuntime()) return;
    setTimeout(() => {
      window.dispatchEvent(new MessageEvent('message', {
        data: {
          action: 'updateLocale',
          translations: {
            bank_name: 'Los Santos Banking',
            deposit_but: 'Deposit',
            withdraw_but: 'Withdraw',
            chart_range_7: '7 days',
            chart_range_30: '30 days',
            chart_daily_title: 'Daily bookings',
            chart_daily_subtitle: 'Totals per calendar day (deposits and withdrawals)',
            chart_balance_title: 'Balance & daily range',
            chart_balance_subtitle:
              'Line: end-of-day balance. Candles: intraday OHLC.',
            chart_trend_up: 'Rising',
            chart_trend_down: 'Falling',
            chart_trend_flat: 'Flat',
            chart_tooltip_open: 'Open',
            chart_tooltip_high: 'High',
            chart_tooltip_low: 'Low',
            chart_tooltip_close: 'Close',
            chart_balance_line: 'End-of-day balance',
            chart_candle_bull: 'Close >= open',
            chart_candle_bear: 'Close < open',
            chart_no_activity_period: 'No transactions in this period',
            transfer_but: 'Transfer',
            amount: 'Amount',
            comment: 'Comment',
            confirm: 'Submit',
            cancel: 'Cancel',
            transfer: 'Business or Citizen ID',
            trans_search: 'Transaction Search...',
            frozen: 'Frozen',
            available: 'Active',
            transaction_processing: 'Processing transaction…',
          },
          currency: 'USD',
        },
      }));
      window.dispatchEvent(new MessageEvent('message', {
        data: {
          action: 'setVisible',
          status: true,
          loading: false,
          atm: false,
          theme: {
            key: 'FLEECA',
            name: 'FLEECA BANK',
            subtitle: 'Premium Homebanking',
            contextLabel: 'Bank',
            location: 'Alta Street / Downtown',
            logo: './img/banks/fleeca-logo.png',
            colors: {
              accent: '#4ade80',
              accent2: '#16a34a',
              accentContrast: '#f0fdf4',
              glow: 'rgba(74, 222, 128, 0.30)',
              flowRingOut: 'rgba(251, 113, 133, 0.28)',
            },
          },
          accounts: [
            {
              id: 'CID-1007',
              type: 'Personal',
              name: 'Frank Hildebrandt',
              frozen: 0,
              amount: 126420,
              cash: 1840,
              transactions: [
                { trans_id: 'tx-1', title: 'Personal Account / CID-1007', amount: 2500, trans_type: 'deposit', receiver: 'FLEECA', message: 'Salary payout', issuer: 'Maze Bank Payroll', time: Math.floor(Date.now() / 1000) - 3000 },
                { trans_id: 'tx-2', title: 'Personal Account / CID-1007', amount: 480, trans_type: 'withdraw', receiver: 'Downtown ATM', message: 'Cash withdrawal', issuer: 'Frank', time: Math.floor(Date.now() / 1000) - 8600 },
                { trans_id: 'tx-3', title: 'Personal Account / CID-1007', amount: 12000, trans_type: 'deposit', receiver: 'FLEECA', message: 'Business transfer', issuer: 'KRGSH GmbH', time: Math.floor(Date.now() / 1000) - 26000 },
              ],
            },
            {
              id: 'krgsh_main',
              type: 'Organization',
              name: 'KRGSH Banking Ops',
              frozen: 0,
              amount: 945000,
              transactions: [
                { trans_id: 'tx-4', title: 'KRGSH Banking Ops / krgsh_main', amount: 50000, trans_type: 'withdraw', receiver: 'Vendor', message: 'Operations payout', issuer: 'KRGSH', time: Math.floor(Date.now() / 1000) - 7000 },
                { trans_id: 'tx-5', title: 'KRGSH Banking Ops / krgsh_main', amount: 80000, trans_type: 'deposit', receiver: 'Invoice', message: 'Client payment', issuer: 'LS Customs', time: Math.floor(Date.now() / 1000) - 17000 },
              ],
            },
          ],
        },
      }));
    }, 150);
  }, []);

  const { visible, loading, atm, toast, theme } = useBankingStore();
  const { data: accounts = [] } = useAccounts();
  const hideToast = useBankingStore((s) => s.hideToast);
  const { t } = useLocale();

  async function handleClose() {
    useBankingStore.getState().setVisible(false, false);
    await postNui('closeInterface');
  }

  // FiveM NUI: Keine Vollbild-Layer im DOM, solange die Bank geschlossen ist — sonst
  // kann CEF den kompletten Gamescreen überdecken/blockieren, selbst bei transparentem CSS.
  return (
    <>
      {visible ? (
        <Box
          style={{
            position: 'fixed',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            padding: rem(24),
            background: 'transparent',
            pointerEvents: 'auto',
          }}
        >
          <Transition mounted transition="fade" duration={200}>
            {(styles) => (
              <Box
                className="rb-glass-shell"
                style={{
                  ...styles,
                  width: '100%',
                  height: '100%',
                  maxWidth: rem(1400),
                  maxHeight: rem(900),
                  position: 'relative',
                  borderRadius: rem(20),
                  overflow: 'hidden',
                  background: 'var(--rb-bg)',
                  border: '1px solid var(--rb-border)',
                }}
              >
                {loading ? (
                  <Portal>
                    <Box
                      style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 6000,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backdropFilter: 'blur(8px)',
                        WebkitBackdropFilter: 'blur(8px)',
                        background: 'rgba(0, 0, 0, 0.48)',
                      }}
                    >
                      <Stack align="center" gap={rem(14)}>
                        <Loader
                          size="xl"
                          type="oval"
                          color="var(--rb-accent)"
                        />
                        <Text
                          size="sm"
                          ta="center"
                          maw={rem(280)}
                          style={{ color: 'var(--rb-text-muted)' }}
                        >
                          {t(
                            'transaction_processing',
                            'Transaktion wird ausgefuehrt…',
                          )}
                        </Text>
                      </Stack>
                    </Box>
                  </Portal>
                ) : null}

                <AppShell
                  header={{ height: rem(64) }}
                  navbar={
                    !atm
                      ? { width: rem(332), breakpoint: 'never' }
                      : undefined
                  }
                  style={{ background: 'transparent', height: '100%' }}
                >
                  <AppShell.Header
                    className="rb-glass-surface"
                    style={{
                      background: 'var(--rb-bg-2)',
                      borderBottom: '1px solid var(--rb-border)',
                    }}
                  >
                    <TopBar
                      theme={theme}
                      atm={atm}
                      onClose={handleClose}
                      t={t}
                    />
                  </AppShell.Header>

                  {!atm && (
                    <AppShell.Navbar
                      className="rb-glass-surface"
                      style={{
                        background: 'var(--rb-bg-2)',
                        borderRight: '1px solid var(--rb-border)',
                        overflowY: 'auto',
                      }}
                    >
                      <Sidebar accounts={accounts} t={t} />
                    </AppShell.Navbar>
                  )}

                  <AppShell.Main
                    className="rb-glass-main"
                    style={{
                      background: 'var(--rb-bg)',
                      overflowY: 'auto',
                      height: '100%',
                    }}
                  >
                    <RoutedOutlet />
                  </AppShell.Main>
                </AppShell>

                <ActionModal t={t} />
              </Box>
            )}
          </Transition>
        </Box>
      ) : null}

      <Transition mounted={!!toast} transition="slide-up" duration={250}>
        {(styles) => (
          <Box
            style={{
              ...styles,
              position: 'fixed',
              bottom: rem(32),
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 600,
              minWidth: rem(320),
              pointerEvents: 'auto',
            }}
          >
            <Notification
              title={theme.contextLabel || t('modeBank', 'Bank')}
              onClose={hideToast}
              color="red"
              radius="md"
              styles={{
                root: {
                  background: 'var(--rb-card)',
                  border: '1px solid var(--rb-border)',
                },
                title: { color: 'var(--rb-accent)' },
                description: { color: 'var(--rb-text)' },
              }}
            >
              {toast}
            </Notification>
          </Box>
        )}
      </Transition>
    </>
  );
}
