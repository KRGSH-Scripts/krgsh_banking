import type { Account, AtmCardOption, Transaction } from '../types';

function getGlobalGetParentResourceName(): (() => string) | undefined {
  const g = globalThis as unknown as { GetParentResourceName?: () => string };
  return typeof g.GetParentResourceName === 'function'
    ? g.GetParentResourceName
    : undefined;
}

/** True wenn die Seite in der FiveM-NUI läuft (nicht im Vite-Browser). */
export function isNuiRuntime(): boolean {
  return getGlobalGetParentResourceName() !== undefined;
}

/**
 * Ordnername der Resource — pro Aufruf auflösen, damit der Host nicht beim
 * ersten Modul-Load festliegt (sonst falsche URL → „callback existiert nicht“).
 */
export function getNuiResourceName(): string {
  return getGlobalGetParentResourceName()?.() ?? 'krgsh_banking';
}

/** @deprecated Nutze getNuiResourceName() — kann beim Bundle-Start noch falsch sein. */
export const RESOURCE_NAME = getNuiResourceName();

export async function postNui<T = unknown>(
  action: string,
  payload?: Record<string, unknown>,
): Promise<T | false> {
  try {
    const host = getNuiResourceName();
    const response = await fetch(`https://${host}/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify(payload ?? {}),
    });
    return (await response.json()) as T;
  } catch {
    return false;
  }
}

export function normalizeAccounts(raw: unknown[]): Account[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((account) => {
    const a = account as Partial<Account>;
    return {
      ...a,
      id: String(a.id ?? ''),
      type: String(a.type ?? ''),
      name: String(a.name ?? ''),
      accountNumber:
        typeof a.accountNumber === 'string' && a.accountNumber !== ''
          ? a.accountNumber
          : undefined,
      amount: Number(a.amount) || 0,
      frozen: Number(a.frozen) || 0,
      transactions: Array.isArray(a.transactions) ? a.transactions : [],
      bankCardId:
        typeof a.bankCardId === 'string' && a.bankCardId !== ''
          ? a.bankCardId
          : undefined,
      canIssueCard: !!(a as { canIssueCard?: unknown }).canIssueCard,
    } as Account;
  });
}

export function normalizeAtmCards(raw: unknown): AtmCardOption[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((row) => {
    const r = row as Partial<AtmCardOption>;
    return {
      accountId: String(r.accountId ?? ''),
      cardId: String(r.cardId ?? ''),
      accountName: String(r.accountName ?? ''),
      label: String(r.label ?? ''),
      needsPin: !!r.needsPin,
    };
  });
}

export function isAtmBankPayload(
  data: unknown,
): data is { accounts: unknown[]; atmCards: unknown[] } {
  if (typeof data !== 'object' || data === null) return false;
  const o = data as { atmCards?: unknown };
  return Array.isArray(o.atmCards);
}

export function getAllTransactions(accounts: Account[]): Transaction[] {
  return accounts
    .flatMap((account) =>
      (account.transactions ?? []).map((tx) => ({
        ...tx,
        __accountId: account.id,
        __accountName: account.name,
      })),
    )
    .sort((a, b) => (Number(b.time) || 0) - (Number(a.time) || 0));
}

