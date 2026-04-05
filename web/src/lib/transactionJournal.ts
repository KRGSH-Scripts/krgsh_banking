import type { Account, Transaction } from '../types';

export type BookingKind = 'deposit' | 'withdraw' | 'transfer_in' | 'transfer_out';

export const JOURNAL_PAGE_SIZE = 25;

export function getPairedTransIds(accounts: Account[]): Set<string> {
  const counts = new Map<string, number>();
  for (const a of accounts) {
    for (const tx of a.transactions ?? []) {
      const id = tx.trans_id;
      if (!id) continue;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  const paired = new Set<string>();
  for (const [id, n] of counts) {
    if (n >= 2) paired.add(id);
  }
  return paired;
}

export function deriveBookingKind(
  tx: Transaction,
  pairedIds: Set<string>,
): BookingKind {
  const type = (tx.trans_type ?? '').toLowerCase();
  const isDeposit = type === 'deposit';
  if (pairedIds.has(tx.trans_id)) {
    return isDeposit ? 'transfer_in' : 'transfer_out';
  }
  return isDeposit ? 'deposit' : 'withdraw';
}

/** Newest-first list with __accountId / __accountName for one account. */
export function injectAccountMeta(account: Account): Transaction[] {
  return (account.transactions ?? []).map((tx) => ({
    ...tx,
    __accountId: account.id,
    __accountName: account.name,
  }));
}

export interface JournalFilters {
  dateFrom: string;
  dateTo: string;
  counterpartyQuery: string;
  counterpartyValues: string[];
  textQuery: string;
  kinds: BookingKind[];
}

export function parseDateInputLocal(ymd: string): Date | null {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return new Date(y, m - 1, d);
}

function startOfDayUnix(d: Date): number {
  const c = new Date(d.getTime());
  c.setHours(0, 0, 0, 0);
  return Math.floor(c.getTime() / 1000);
}

function endOfDayUnix(d: Date): number {
  const c = new Date(d.getTime());
  c.setHours(23, 59, 59, 999);
  return Math.floor(c.getTime() / 1000);
}

export function collectCounterpartyOptions(txs: Transaction[]): string[] {
  const set = new Set<string>();
  for (const tx of txs) {
    const i = (tx.issuer ?? '').trim();
    const r = (tx.receiver ?? '').trim();
    if (i) set.add(i);
    if (r) set.add(r);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

function matchesCounterpartyMulti(
  tx: Transaction,
  values: string[],
): boolean {
  const iss = tx.issuer ?? '';
  const rec = tx.receiver ?? '';
  return values.some((v) => {
    const needle = v.trim();
    if (!needle) return false;
    return iss === needle || rec === needle;
  });
}

function matchesCounterpartyQuery(tx: Transaction, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const iss = (tx.issuer ?? '').toLowerCase();
  const rec = (tx.receiver ?? '').toLowerCase();
  return iss.includes(needle) || rec.includes(needle);
}

export function filterTransactions(
  txs: Transaction[],
  filters: JournalFilters,
  pairedIds: Set<string>,
): Transaction[] {
  let out = [...txs];
  out.sort((a, b) => (Number(b.time) || 0) - (Number(a.time) || 0));

  const fromD = filters.dateFrom ? parseDateInputLocal(filters.dateFrom) : null;
  const toD = filters.dateTo ? parseDateInputLocal(filters.dateTo) : null;
  const fromTs = fromD ? startOfDayUnix(fromD) : null;
  const toTs = toD ? endOfDayUnix(toD) : null;

  if (fromTs !== null) {
    out = out.filter((tx) => (Number(tx.time) || 0) >= fromTs);
  }
  if (toTs !== null) {
    out = out.filter((tx) => (Number(tx.time) || 0) <= toTs);
  }

  if (filters.counterpartyValues.length > 0) {
    out = out.filter((tx) => matchesCounterpartyMulti(tx, filters.counterpartyValues));
  }
  if (filters.counterpartyQuery.trim()) {
    out = out.filter((tx) => matchesCounterpartyQuery(tx, filters.counterpartyQuery));
  }

  const tq = filters.textQuery.trim().toLowerCase();
  if (tq) {
    out = out.filter((tx) => {
      const hay = `${tx.message ?? ''} ${tx.title ?? ''}`.toLowerCase();
      return hay.includes(tq);
    });
  }

  if (filters.kinds.length > 0) {
    const allowed = new Set(filters.kinds);
    out = out.filter((tx) => allowed.has(deriveBookingKind(tx, pairedIds)));
  }

  return out;
}

export function paginate<T>(
  list: T[],
  page: number,
  pageSize = JOURNAL_PAGE_SIZE,
): { slice: T[]; total: number; pageCount: number; page: number } {
  const total = list.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize) || 1);
  const p = Math.min(Math.max(1, page), pageCount);
  const start = (p - 1) * pageSize;
  const slice = list.slice(start, start + pageSize);
  return { slice, total, pageCount, page: p };
}
