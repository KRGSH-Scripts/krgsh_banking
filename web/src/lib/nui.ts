import type { Account, Transaction } from '../types';

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

export const RESOURCE_NAME = getGlobalGetParentResourceName()?.() ?? 'krgsh_banking';

export async function postNui<T = unknown>(
  action: string,
  payload?: Record<string, unknown>,
): Promise<T | false> {
  try {
    const response = await fetch(`https://${RESOURCE_NAME}/${action}`, {
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
    } as Account;
  });
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

