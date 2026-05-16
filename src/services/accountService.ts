import { createAuditLog } from '../db/repositories/auditLogRepository';
import { getAll, getFirst, withTransaction } from '../db/database';
import type { Account, AccountType, ListFilter, Transaction } from '../domain/types';
import { DEFAULT_CURRENCY } from '../domain/constants';
import { assertPositiveAmount, assertRequired } from '../domain/validators';
import { nowIso, todayDbDate } from '../utils/dates';
import { createId } from '../utils/ids';
import { roundMoney } from '../utils/money';
import { insertTransactionWithBalance } from './transactionService';

export interface CreateAccountInput {
  name: string;
  type: AccountType;
  initialBalance?: number;
  currency?: string;
  notes?: string | null;
  importHash?: string | null;
}

export interface UpdateAccountInput {
  id: string;
  name?: string;
  type?: AccountType;
  currency?: string;
  notes?: string | null;
}

export async function listAccounts(filter: ListFilter = {}): Promise<Account[]> {
  const where: string[] = [];
  const params: unknown[] = [];

  if (filter.type) {
    where.push('type = ?');
    params.push(filter.type);
  }

  if (filter.text) {
    where.push('(name LIKE ? OR notes LIKE ?)');
    const text = `%${filter.text}%`;
    params.push(text, text);
  }

  const sql = `SELECT * FROM accounts
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY name COLLATE NOCASE ASC`;

  return getAll<Account>(sql, params);
}

export async function getAccountById(id: string): Promise<Account | null> {
  return getFirst<Account>('SELECT * FROM accounts WHERE id = ?', [id]);
}

export async function getAccountTransactions(accountId: string): Promise<Transaction[]> {
  return getAll<Transaction>(
    `SELECT * FROM transactions
     WHERE account_id = ?
     ORDER BY date DESC, created_at DESC`,
    [accountId],
  );
}

export async function createAccount(input: CreateAccountInput): Promise<Account> {
  assertRequired(input.name, 'Nombre');
  assertRequired(input.type, 'Tipo');

  return withTransaction(async (db) => {
    const timestamp = nowIso();
    const initialBalance = roundMoney(input.initialBalance ?? 0);
    const account: Account = {
      id: createId('acc'),
      name: input.name.trim(),
      type: input.type,
      initial_balance: initialBalance,
      current_balance: initialBalance,
      currency: input.currency ?? DEFAULT_CURRENCY,
      notes: input.notes ?? null,
      import_hash: input.importHash ?? null,
      created_at: timestamp,
      updated_at: timestamp,
    };

    await db.runAsync(
      `INSERT INTO accounts
        (id, name, type, initial_balance, current_balance, currency, notes, import_hash, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        account.id,
        account.name,
        account.type,
        account.initial_balance,
        account.current_balance,
        account.currency,
        account.notes,
        account.import_hash,
        account.created_at,
        account.updated_at,
      ],
    );

    await createAuditLog(db, {
      action: 'create',
      tableName: 'accounts',
      recordId: account.id,
      newValue: account,
    });

    return account;
  });
}

export async function updateAccount(input: UpdateAccountInput): Promise<Account> {
  assertRequired(input.id, 'Cuenta');

  return withTransaction(async (db) => {
    const previous = await db.getFirstAsync<Account>('SELECT * FROM accounts WHERE id = ?', [
      input.id,
    ]);

    if (!previous) {
      throw new Error('Cuenta no encontrada.');
    }

    const next: Account = {
      ...previous,
      name: input.name !== undefined ? input.name.trim() : previous.name,
      type: input.type ?? previous.type,
      currency: input.currency ?? previous.currency,
      notes: input.notes !== undefined ? input.notes : previous.notes,
      updated_at: nowIso(),
    };

    await db.runAsync(
      `UPDATE accounts
       SET name = ?, type = ?, currency = ?, notes = ?, updated_at = ?
       WHERE id = ?`,
      [next.name, next.type, next.currency, next.notes, next.updated_at, next.id],
    );

    await createAuditLog(db, {
      action: 'update',
      tableName: 'accounts',
      recordId: next.id,
      oldValue: previous,
      newValue: next,
    });

    return next;
  });
}

export async function deleteAccount(id: string, force = false): Promise<void> {
  assertRequired(id, 'Cuenta');

  await withTransaction(async (db) => {
    const account = await db.getFirstAsync<Account>('SELECT * FROM accounts WHERE id = ?', [id]);

    if (!account) {
      return;
    }

    const usage = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) AS count
       FROM transactions
       WHERE account_id = ?`,
      [id],
    );

    if ((usage?.count ?? 0) > 0 && !force) {
      throw new Error('La cuenta tiene movimientos. Confirma el borrado forzado o conserva el historial.');
    }

    await db.runAsync('DELETE FROM transactions WHERE account_id = ?', [id]);
    await db.runAsync('DELETE FROM accounts WHERE id = ?', [id]);
    await createAuditLog(db, {
      action: 'delete',
      tableName: 'accounts',
      recordId: id,
      oldValue: account,
    });
  });
}

export async function adjustAccountBalance(
  accountId: string,
  targetBalance: number,
  notes?: string | null,
): Promise<Transaction> {
  return withTransaction(async (db) => {
    const account = await db.getFirstAsync<Account>('SELECT * FROM accounts WHERE id = ?', [
      accountId,
    ]);

    if (!account) {
      throw new Error('Cuenta no encontrada.');
    }

    const delta = roundMoney(targetBalance - account.current_balance);

    if (delta === 0) {
      throw new Error('El saldo objetivo ya coincide con el saldo actual.');
    }

    return insertTransactionWithBalance(
      db,
      {
        accountId,
        type: 'ajuste',
        amount: delta,
        date: todayDbDate(),
        category: 'ajuste',
        description: 'Ajuste de saldo',
        notes,
      },
      true,
    );
  });
}

export async function addManualDeposit(
  accountId: string,
  amount: number,
  notes?: string | null,
): Promise<Transaction> {
  assertPositiveAmount(amount, 'Importe');
  return insertSimpleAccountMovement(accountId, amount, 'deposito', 'Deposito manual', notes);
}

export async function addManualWithdrawal(
  accountId: string,
  amount: number,
  notes?: string | null,
): Promise<Transaction> {
  assertPositiveAmount(amount, 'Importe');
  return insertSimpleAccountMovement(accountId, amount, 'retirada', 'Retirada manual', notes);
}

async function insertSimpleAccountMovement(
  accountId: string,
  amount: number,
  type: 'deposito' | 'retirada',
  description: string,
  notes?: string | null,
): Promise<Transaction> {
  return withTransaction((db) =>
    insertTransactionWithBalance(
      db,
      {
        accountId,
        type,
        amount,
        date: todayDbDate(),
        description,
        notes,
      },
      true,
    ),
  );
}
