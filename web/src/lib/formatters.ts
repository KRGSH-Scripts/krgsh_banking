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

export interface ChartBucket {
  label: string;
  value: number;
  pct: number;
  type: 'in' | 'out';
}

export function chartBuckets(account: Account): ChartBucket[] {
  const txs = (account.transactions ?? []).slice(0, 6).reverse();
  const max = Math.max(1, ...txs.map((tx) => Math.abs(Number(tx.amount) || 0)));
  return txs.map((tx, i) => {
    const val = Math.abs(Number(tx.amount) || 0);
    return {
      label: String(i + 1),
      value: val,
      pct: Math.max(10, Math.round((val / max) * 100)),
      type: (tx.trans_type ?? '').toLowerCase() === 'deposit' ? 'in' : 'out',
    };
  });
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
