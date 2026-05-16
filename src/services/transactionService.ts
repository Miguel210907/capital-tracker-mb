import type { SQLiteDatabase } from 'expo-sqlite';

import { createAuditLog } from '../db/repositories/auditLogRepository';
import { getAll, getFirst, withTransaction } from '../db/database';
import type { ListFilter, Transaction, TransactionType, Transfer } from '../domain/types';
import {
  assertDifferentAccounts,
  assertPositiveAmount,
  assertRequired,
} from '../domain/validators';
import { nowIso, todayDbDate } from '../utils/dates';
import { createId } from '../utils/ids';
import { roundMoney } from '../utils/money';
import { normalizeTransactionAmount } from './calculations';

export interface CreateTransactionInput {
  date?: string;
  accountId: string;
  type: TransactionType;
  category?: string | null;
  amount: number;
  description?: string | null;
  relatedBetId?: string | null;
  relatedMatchedBetId?: string | null;
  transferId?: string | null;
  notes?: string | null;
  importHash?: string | null;
}

export interface UpdateTransactionInput {
  id: string;
  date?: string;
  accountId?: string;
  type?: TransactionType;
  category?: string | null;
  amount?: number;
  description?: string | null;
  notes?: string | null;
}

export interface CreateTransferInput {
  date?: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  fee?: number;
  notes?: string | null;
}

export async function listTransactions(filter: ListFilter = {}): Promise<Transaction[]> {
  const where: string[] = [];
  const params: unknown[] = [];

  if (filter.from) {
    where.push('date >= ?');
    params.push(filter.from);
  }

  if (filter.to) {
    where.push('date <= ?');
    params.push(filter.to);
  }

  if (filter.accountId) {
    where.push('account_id = ?');
    params.push(filter.accountId);
  }

  if (filter.type) {
    where.push('type = ?');
    params.push(filter.type);
  }

  if (filter.category) {
    where.push('category = ?');
    params.push(filter.category);
  }

  if (filter.text) {
    where.push('(description LIKE ? OR notes LIKE ? OR category LIKE ?)');
    const text = `%${filter.text}%`;
    params.push(text, text, text);
  }

  const sql = `SELECT * FROM transactions
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY date DESC, created_at DESC`;

  return getAll<Transaction>(sql, params);
}

export async function getTransactionById(id: string): Promise<Transaction | null> {
  return getFirst<Transaction>('SELECT * FROM transactions WHERE id = ?', [id]);
}

export async function createTransaction(input: CreateTransactionInput): Promise<Transaction> {
  return withTransaction((db) => insertTransactionWithBalance(db, input, true));
}

export async function createIncome(input: Omit<CreateTransactionInput, 'type'>): Promise<Transaction> {
  return createTransaction({ ...input, type: 'ingreso' });
}

export async function createExpense(input: Omit<CreateTransactionInput, 'type'>): Promise<Transaction> {
  return createTransaction({ ...input, type: 'gasto' });
}

export async function createTransfer(input: CreateTransferInput): Promise<Transfer> {
  assertRequired(input.fromAccountId, 'Cuenta origen');
  assertRequired(input.toAccountId, 'Cuenta destino');
  assertDifferentAccounts(input.fromAccountId, input.toAccountId);
  assertPositiveAmount(input.amount, 'Importe');

  const fee = roundMoney(input.fee ?? 0);
  if (fee < 0) {
    throw new Error('La comision no puede ser negativa.');
  }

  return withTransaction(async (db) => {
    const timestamp = nowIso();
    const transfer: Transfer = {
      id: createId('trf'),
      date: input.date ?? todayDbDate(),
      from_account_id: input.fromAccountId,
      to_account_id: input.toAccountId,
      amount: roundMoney(input.amount),
      fee,
      notes: input.notes ?? null,
      import_hash: null,
      created_at: timestamp,
    };

    await db.runAsync(
      `INSERT INTO transfers
        (id, date, from_account_id, to_account_id, amount, fee, notes, import_hash, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        transfer.id,
        transfer.date,
        transfer.from_account_id,
        transfer.to_account_id,
        transfer.amount,
        transfer.fee,
        transfer.notes,
        transfer.import_hash,
        transfer.created_at,
      ],
    );

    await insertTransactionWithBalance(
      db,
      {
        date: transfer.date,
        accountId: transfer.from_account_id,
        type: 'transferencia_salida',
        amount: transfer.amount,
        category: 'transferencia',
        description: 'Transferencia enviada',
        transferId: transfer.id,
        notes: transfer.notes,
      },
      false,
    );

    await insertTransactionWithBalance(
      db,
      {
        date: transfer.date,
        accountId: transfer.to_account_id,
        type: 'transferencia_entrada',
        amount: transfer.amount,
        category: 'transferencia',
        description: 'Transferencia recibida',
        transferId: transfer.id,
        notes: transfer.notes,
      },
      false,
    );

    if (transfer.fee > 0) {
      await insertTransactionWithBalance(
        db,
        {
          date: transfer.date,
          accountId: transfer.from_account_id,
          type: 'comision',
          amount: transfer.fee,
          category: 'comisiones',
          description: 'Comision de transferencia',
          transferId: transfer.id,
          notes: transfer.notes,
        },
        false,
      );
    }

    await createAuditLog(db, {
      action: 'create',
      tableName: 'transfers',
      recordId: transfer.id,
      newValue: transfer,
    });

    return transfer;
  });
}

export async function updateTransaction(input: UpdateTransactionInput): Promise<Transaction> {
  assertRequired(input.id, 'Movimiento');

  return withTransaction(async (db) => {
    const previous = await db.getFirstAsync<Transaction>(
      'SELECT * FROM transactions WHERE id = ?',
      [input.id],
    );

    if (!previous) {
      throw new Error('Movimiento no encontrado.');
    }

    if (previous.related_bet_id || previous.related_matched_bet_id) {
      throw new Error('Este movimiento esta vinculado a una apuesta. Edita la apuesta asociada.');
    }

    await applyAccountDelta(db, previous.account_id, -previous.amount);

    const nextType = input.type ?? previous.type;
    const rawAmount = input.amount ?? previous.amount;
    const amount = normalizeTransactionAmount(nextType, rawAmount);
    const timestamp = nowIso();
    const next: Transaction = {
      ...previous,
      date: input.date ?? previous.date,
      account_id: input.accountId ?? previous.account_id,
      type: nextType,
      category: input.category !== undefined ? input.category : previous.category,
      amount,
      description:
        input.description !== undefined ? input.description : previous.description,
      notes: input.notes !== undefined ? input.notes : previous.notes,
      updated_at: timestamp,
    };

    await db.runAsync(
      `UPDATE transactions
       SET date = ?, account_id = ?, type = ?, category = ?, amount = ?,
           description = ?, notes = ?, updated_at = ?
       WHERE id = ?`,
      [
        next.date,
        next.account_id,
        next.type,
        next.category,
        next.amount,
        next.description,
        next.notes,
        next.updated_at,
        next.id,
      ],
    );

    await applyAccountDelta(db, next.account_id, next.amount);
    await createAuditLog(db, {
      action: 'update',
      tableName: 'transactions',
      recordId: next.id,
      oldValue: previous,
      newValue: next,
    });

    return next;
  });
}

export async function deleteTransaction(id: string): Promise<void> {
  assertRequired(id, 'Movimiento');

  await withTransaction(async (db) => {
    const previous = await db.getFirstAsync<Transaction>(
      'SELECT * FROM transactions WHERE id = ?',
      [id],
    );

    if (!previous) {
      return;
    }

    if (previous.related_bet_id || previous.related_matched_bet_id) {
      throw new Error('Este movimiento esta vinculado a una apuesta. Borra o corrige la apuesta asociada.');
    }

    await applyAccountDelta(db, previous.account_id, -previous.amount);
    await db.runAsync('DELETE FROM transactions WHERE id = ?', [id]);
    await createAuditLog(db, {
      action: 'delete',
      tableName: 'transactions',
      recordId: id,
      oldValue: previous,
    });
  });
}

export async function recalculateBalances(): Promise<void> {
  await withTransaction(async (db) => {
    await db.runAsync(
      `UPDATE accounts
       SET current_balance = initial_balance,
           updated_at = ?
       WHERE 1 = 1`,
      [nowIso()],
    );

    await db.runAsync(
      `UPDATE accounts
       SET current_balance = ROUND(
         initial_balance + COALESCE((
           SELECT SUM(amount)
           FROM transactions
           WHERE transactions.account_id = accounts.id
         ), 0),
         2
       ),
       updated_at = ?
       WHERE 1 = 1`,
      [nowIso()],
    );

    await createAuditLog(db, {
      action: 'recalculate',
      tableName: 'accounts',
      newValue: { message: 'Saldos recalculados desde movimientos.' },
    });
  });
}

export async function insertTransactionWithBalance(
  db: SQLiteDatabase,
  input: CreateTransactionInput,
  audit = true,
): Promise<Transaction> {
  assertRequired(input.accountId, 'Cuenta');
  assertRequired(input.type, 'Tipo de movimiento');

  if (!Number.isFinite(input.amount)) {
    throw new Error('Importe no valido.');
  }

  const timestamp = nowIso();
  const type = input.type;
  const amount = normalizeTransactionAmount(type, input.amount);
  const transaction: Transaction = {
    id: createId('mov'),
    date: input.date ?? todayDbDate(),
    account_id: input.accountId,
    type,
    category: input.category ?? null,
    amount,
    description: input.description ?? null,
    related_bet_id: input.relatedBetId ?? null,
    related_matched_bet_id: input.relatedMatchedBetId ?? null,
    transfer_id: input.transferId ?? null,
    notes: input.notes ?? null,
    import_hash: input.importHash ?? null,
    created_at: timestamp,
    updated_at: timestamp,
  };

  await db.runAsync(
    `INSERT INTO transactions
      (id, date, account_id, type, category, amount, description,
       related_bet_id, related_matched_bet_id, transfer_id, notes, import_hash,
       created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      transaction.id,
      transaction.date,
      transaction.account_id,
      transaction.type,
      transaction.category,
      transaction.amount,
      transaction.description,
      transaction.related_bet_id,
      transaction.related_matched_bet_id,
      transaction.transfer_id,
      transaction.notes,
      transaction.import_hash,
      transaction.created_at,
      transaction.updated_at,
    ],
  );

  await applyAccountDelta(db, transaction.account_id, transaction.amount);

  if (audit) {
    await createAuditLog(db, {
      action: 'create',
      tableName: 'transactions',
      recordId: transaction.id,
      newValue: transaction,
    });
  }

  return transaction;
}

export async function applyAccountDelta(
  db: SQLiteDatabase,
  accountId: string,
  delta: number,
): Promise<void> {
  await db.runAsync(
    `UPDATE accounts
     SET current_balance = ROUND(current_balance + ?, 2),
         updated_at = ?
     WHERE id = ?`,
    [roundMoney(delta), nowIso(), accountId],
  );
}
