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

export function accountMask(account: Account): string {
  const raw = String(account.id ?? '')
    .replace(/\s+/g, '')
    .toUpperCase();
  const head = raw.slice(0, 4) || 'BANK';
  const tail = raw.slice(-4) || '0000';
  return `${head} •••• ${tail}`;
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

export interface DailyMovementPoint {
  /** Short label for the chart X axis (local calendar day). */
  day: string;
  /** Local calendar day `YYYY-MM-DD`. */
  dateKey: string;
  deposit: number;
  withdraw: number;
}

function localDateKeyFromUnix(sec: number): string {
  const d = new Date(sec * 1000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Last `dayCount` calendar days (local), oldest → newest; sums per day. */
export function dailyMovementSeries(
  account: Account,
  dayCount: 7 | 30,
): DailyMovementPoint[] {
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
  const firstDayStart = new Date(todayStart);
  firstDayStart.setDate(firstDayStart.getDate() - (dayCount - 1));

  const startSec = Math.floor(firstDayStart.getTime() / 1000);
  const endSec =
    Math.floor(todayStart.getTime() / 1000) + 24 * 60 * 60 - 1;

  const points: DailyMovementPoint[] = [];
  const cursor = new Date(firstDayStart);
  for (let i = 0; i < dayCount; i++) {
    const y = cursor.getFullYear();
    const mo = cursor.getMonth();
    const da = cursor.getDate();
    const dateKey = `${y}-${String(mo + 1).padStart(2, '0')}-${String(da).padStart(2, '0')}`;
    const day = cursor.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
    });
    points.push({ day, dateKey, deposit: 0, withdraw: 0 });
    cursor.setDate(cursor.getDate() + 1);
  }

  const byKey = new Map(
    points.map((p) => [p.dateKey, p] as const),
  );

  for (const tx of account.transactions ?? []) {
    const t = Number(tx.time);
    if (!Number.isFinite(t) || t < startSec || t > endSec) continue;
    const key = localDateKeyFromUnix(t);
    const row = byKey.get(key);
    if (!row) continue;
    const amt = Math.abs(Number(tx.amount) || 0);
    if ((tx.trans_type ?? '').toLowerCase() === 'deposit')
      row.deposit += amt;
    else row.withdraw += amt;
  }

  return points;
}

export function dailySeriesHasActivity(points: DailyMovementPoint[]): boolean {
  return points.some((p) => p.deposit > 0 || p.withdraw > 0);
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
