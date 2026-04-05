import type { Account, Transaction } from '../types';

export function formatMoney(value: number, currency = 'USD'): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `$${Math.round(value).toLocaleString('en-US')}`;
  }
}

export function formatDate(unix: number): string {
  if (!unix) return '-';
  const date = new Date(Number(unix) * 1000);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function relativeTime(
  unix: number,
  locale: Record<string, string>,
): string {
  if (!unix) return '-';
  const t = (key: string, fallback: string) =>
    (locale[key] as string | undefined) ?? fallback;
  const seconds = Math.max(0, Math.floor(Date.now() / 1000) - Number(unix));
  if (seconds < 60) return t('secs', 'Gerade eben');
  const mins = Math.floor(seconds / 60);
  if (mins < 60)
    return mins === 1
      ? t('amin', 'Vor 1 Minute')
      : t('mins', 'Vor %s Minuten').replace('%s', String(mins));
  const hours = Math.floor(mins / 60);
  if (hours < 24)
    return hours === 1
      ? t('ahour', 'Vor 1 Stunde')
      : t('hours', 'Vor %s Stunden').replace('%s', String(hours));
  const days = Math.floor(hours / 24);
  if (days < 7)
    return days === 1
      ? t('aday', 'Vor 1 Tag')
      : t('days', 'Vor %s Tagen').replace('%s', String(days));
  const weeks = Math.floor(days / 7);
  return weeks === 1
    ? t('aweek', 'Vor 1 Woche')
    : t('weeks', 'Vor %s Wochen').replace('%s', String(weeks));
}

/** Full account number for UI (server sends `accountNumber`; fallback to internal `id`). */
export function displayAccountNumber(account: Account): string {
  const n = account.accountNumber ?? account.id;
  return String(n ?? '');
}

export function accountTone(
  account: Account,
  locale: Record<string, string>,
): string {
  const type = String(account.type ?? '').toLowerCase();
  if (type.includes('personal'))
    return (locale['pers_account'] as string | undefined) ?? 'Privatkonto';
  if (type.includes('org'))
    return (locale['soc_account'] as string | undefined) ?? 'Geschäftskonto';
  return account.type ?? 'Konto';
}

export function themeTag(account: Account): string {
  const type = String(account.type ?? '').toLowerCase();
  if (type.includes('personal')) return 'PERSONAL';
  if (type.includes('org')) return 'BUSINESS';
  return String(account.type ?? 'ACCOUNT').toUpperCase();
}

export interface AccountMetrics {
  inflow: number;
  outflow: number;
}

export function metricsForAccount(account: Account): AccountMetrics {
  const txs = account.transactions ?? [];
  let inflow = 0;
  let outflow = 0;
  for (const tx of txs) {
    const amount = Math.abs(Number(tx.amount) || 0);
    if ((tx.trans_type ?? '').toLowerCase() === 'deposit') inflow += amount;
    else outflow += amount;
  }
  return { inflow, outflow };
}

function localDateKeyFromUnix(sec: number): string {
  const d = new Date(sec * 1000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDaysLocal(base: Date, deltaDays: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + deltaDays);
  return d;
}

function dateKeyFromLocalDate(d: Date): string {
  const y = d.getFullYear();
  const mo = d.getMonth();
  const da = d.getDate();
  return `${y}-${String(mo + 1).padStart(2, '0')}-${String(da).padStart(2, '0')}`;
}

function dayLabelFromLocalDate(d: Date): string {
  return d.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
  });
}

function compareDateKeys(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Balance immediately before the chronologically oldest transaction (or current amount if none). */
function balanceBeforeOldestTx(account: Account): number {
  const txs = [...(account.transactions ?? [])].filter((tx) =>
    Number.isFinite(Number(tx.time)),
  );
  txs.sort((a, b) => (Number(b.time) || 0) - (Number(a.time) || 0));
  let b = Number(account.amount) || 0;
  for (const tx of txs) {
    const amt = Math.abs(Number(tx.amount) || 0);
    const type = (tx.trans_type ?? '').toLowerCase();
    if (type === 'deposit') b -= amt;
    else b += amt;
  }
  return b;
}

export interface DailyOhlcPoint {
  /** Short label for the chart X axis (local calendar day). */
  day: string;
  /** Local calendar day `YYYY-MM-DD`. */
  dateKey: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

/**
 * Last `dayCount` calendar days (local), oldest → newest.
 * Reconstructs running balance from `account.amount` and full transaction history.
 */
export function dailyBalanceOhlcSeries(
  account: Account,
  dayCount: 7 | 30,
): DailyOhlcPoint[] {
  const now = new Date();
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0,
    0,
  );
  const firstWindowDay = new Date(todayStart);
  firstWindowDay.setDate(firstWindowDay.getDate() - (dayCount - 1));
  const dayBeforeWindow = addDaysLocal(firstWindowDay, -1);
  const simStartKey = dateKeyFromLocalDate(dayBeforeWindow);
  const windowStartKey = dateKeyFromLocalDate(firstWindowDay);
  const endKey = dateKeyFromLocalDate(todayStart);

  const initial = balanceBeforeOldestTx(account);
  const txsAsc = [...(account.transactions ?? [])]
    .filter((tx) => Number.isFinite(Number(tx.time)))
    .sort((a, b) => (Number(a.time) || 0) - (Number(b.time) || 0));

  const byDay = new Map<string, typeof txsAsc>();
  for (const tx of txsAsc) {
    const key = localDateKeyFromUnix(Number(tx.time));
    const list = byDay.get(key);
    if (list) list.push(tx);
    else byDay.set(key, [tx]);
  }

  let running = initial;
  for (const tx of txsAsc) {
    const key = localDateKeyFromUnix(Number(tx.time));
    if (compareDateKeys(key, simStartKey) >= 0) break;
    const amt = Math.abs(Number(tx.amount) || 0);
    if ((tx.trans_type ?? '').toLowerCase() === 'deposit') running += amt;
    else running -= amt;
  }

  const built: DailyOhlcPoint[] = [];
  const cursor = new Date(dayBeforeWindow);
  while (compareDateKeys(dateKeyFromLocalDate(cursor), endKey) <= 0) {
    const dateKey = dateKeyFromLocalDate(cursor);
    const open = running;
    let high = open;
    let low = open;
    const dayTxs = [...(byDay.get(dateKey) ?? [])].sort(
      (a, b) => (Number(a.time) || 0) - (Number(b.time) || 0),
    );
    for (const tx of dayTxs) {
      const amt = Math.abs(Number(tx.amount) || 0);
      if ((tx.trans_type ?? '').toLowerCase() === 'deposit') running += amt;
      else running -= amt;
      high = Math.max(high, running);
      low = Math.min(low, running);
    }
    const close = running;
    built.push({
      day: dayLabelFromLocalDate(cursor),
      dateKey,
      open,
      high,
      low,
      close,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return built.filter((p) => compareDateKeys(p.dateKey, windowStartKey) >= 0);
}

export type TrendDirection = 'up' | 'down' | 'flat';

export interface TrendFromCloses {
  delta: number;
  deltaPct: number;
  direction: TrendDirection;
}

const TREND_FLAT_EPS = 1e-6;
/** Min |balance| used as %-basis; avoids absurd % when start is 0 and matches integer money. */
const TREND_REF_MIN = 1;

/**
 * Relative change vs. period start when possible; if start ≈ 0, vs. end; if both ≈ 0, % = 0.
 */
export function trendFromCloses(points: DailyOhlcPoint[]): TrendFromCloses {
  if (points.length === 0) {
    return { delta: 0, deltaPct: 0, direction: 'flat' };
  }
  const first = points[0]!.close;
  const last = points[points.length - 1]!.close;
  const delta = last - first;

  let deltaPct = 0;
  if (Math.abs(first) >= TREND_REF_MIN) {
    deltaPct = (delta / first) * 100;
  } else if (Math.abs(last) >= TREND_REF_MIN) {
    deltaPct = (delta / last) * 100;
  } else if (Math.abs(delta) >= TREND_REF_MIN) {
    deltaPct = delta > 0 ? 100 : -100;
  }

  let direction: TrendDirection = 'flat';
  if (delta > TREND_FLAT_EPS) direction = 'up';
  else if (delta < -TREND_FLAT_EPS) direction = 'down';
  return { delta, deltaPct, direction };
}

export function sumAccountBalances(accounts: Account[]): number {
  return accounts.reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
}

export function getCashBalance(accounts: Account[]): number {
  const personal = accounts.find((a) => typeof a.cash === 'number');
  return personal ? Number(personal.cash) || 0 : 0;
}

export function latestTransaction(
  accounts: Account[],
): Transaction | undefined {
  return accounts
    .flatMap((a) => a.transactions ?? [])
    .sort((a, b) => (Number(b.time) || 0) - (Number(a.time) || 0))[0];
}
