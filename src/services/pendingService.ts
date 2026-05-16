import type { SQLiteDatabase } from 'expo-sqlite';

import { createAuditLog } from '../db/repositories/auditLogRepository';
import { getAll, getFirst, sqlParams, withTransaction } from '../db/database';
import type {
  ListFilter,
  MatchedBet,
  PendingItem,
  PendingItemStatus,
  PendingItemType,
} from '../domain/types';
import { assertRequired } from '../domain/validators';
import { endOfMonthDbDate, nowIso, startOfMonthDbDate, todayDbDate } from '../utils/dates';
import { createId } from '../utils/ids';
import { roundMoney } from '../utils/money';

export interface PendingSummary {
  expectedProfitMonth: number;
  expectedProfitTotal: number;
  expectedIncomeTotal: number;
  investmentRequiredTotal: number;
  overdueCount: number;
  nextSevenDaysCount: number;
}

export interface CreatePendingItemInput {
  title: string;
  type: PendingItemType;
  status?: PendingItemStatus;
  createdDate?: string;
  expectedDate?: string | null;
  accountId?: string | null;
  relatedBetId?: string | null;
  relatedMatchedBetId?: string | null;
  relatedTransactionId?: string | null;
  investmentRequired?: number;
  expectedIncome?: number;
  expectedExpense?: number;
  expectedProfit?: number;
  actualProfit?: number;
  priority?: number;
  recurrence?: string | null;
  notes?: string | null;
  importHash?: string | null;
}

export interface UpdatePendingItemInput extends Partial<CreatePendingItemInput> {
  id: string;
}

interface SumRow {
  total: number | null;
}

interface CountRow {
  total: number | null;
}

export async function listPendingItems(filter: ListFilter = {}): Promise<PendingItem[]> {
  const where: string[] = [];
  const params: unknown[] = [];

  if (filter.from) {
    where.push('COALESCE(expected_date, created_date) >= ?');
    params.push(filter.from);
  }

  if (filter.to) {
    where.push('COALESCE(expected_date, created_date) <= ?');
    params.push(filter.to);
  }

  if (filter.type) {
    where.push('type = ?');
    params.push(filter.type);
  }

  if (filter.status) {
    where.push('status = ?');
    params.push(filter.status);
  }

  if (filter.accountId) {
    where.push('account_id = ?');
    params.push(filter.accountId);
  }

  if (filter.text) {
    where.push('(title LIKE ? OR notes LIKE ? OR type LIKE ?)');
    const text = `%${filter.text}%`;
    params.push(text, text, text);
  }

  if (filter.profitSign === 'positive') {
    where.push('expected_profit > 0');
  }

  if (filter.profitSign === 'negative') {
    where.push('expected_profit < 0');
  }

  return getAll<PendingItem>(
    `SELECT * FROM pending_items
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY
       CASE status
         WHEN 'vencido' THEN 0
         WHEN 'en_curso' THEN 1
         WHEN 'pendiente' THEN 2
         WHEN 'completado' THEN 3
         ELSE 4
       END,
       COALESCE(expected_date, created_date) ASC,
       priority ASC,
       created_at DESC`,
    params,
  );
}

export async function getPendingItemById(id: string): Promise<PendingItem | null> {
  return getFirst<PendingItem>('SELECT * FROM pending_items WHERE id = ?', [id]);
}

export async function getPendingSummary(): Promise<PendingSummary> {
  const monthStart = startOfMonthDbDate();
  const monthEnd = endOfMonthDbDate();
  const today = todayDbDate();
  const nextSevenDays = addDays(today, 7);

  const expectedProfitMonth = await sumSql(
    `SELECT SUM(expected_profit) AS total
     FROM pending_items
     WHERE status IN ('pendiente', 'en_curso', 'vencido')
       AND expected_date BETWEEN ? AND ?`,
    [monthStart, monthEnd],
  );

  const expectedProfitTotal = await sumSql(
    `SELECT SUM(expected_profit) AS total
     FROM pending_items
     WHERE status IN ('pendiente', 'en_curso', 'vencido')`,
  );

  const expectedIncomeTotal = await sumSql(
    `SELECT SUM(expected_income) AS total
     FROM pending_items
     WHERE status IN ('pendiente', 'en_curso', 'vencido')`,
  );

  const investmentRequiredTotal = await sumSql(
    `SELECT SUM(investment_required) AS total
     FROM pending_items
     WHERE status IN ('pendiente', 'en_curso', 'vencido')`,
  );

  const overdueCount = await countSql(
    `SELECT COUNT(*) AS total
     FROM pending_items
     WHERE status IN ('pendiente', 'en_curso')
       AND expected_date IS NOT NULL
       AND expected_date < ?`,
    [today],
  );

  const nextSevenDaysCount = await countSql(
    `SELECT COUNT(*) AS total
     FROM pending_items
     WHERE status IN ('pendiente', 'en_curso')
       AND expected_date BETWEEN ? AND ?`,
    [today, nextSevenDays],
  );

  return {
    expectedProfitMonth,
    expectedProfitTotal,
    expectedIncomeTotal,
    investmentRequiredTotal,
    overdueCount,
    nextSevenDaysCount,
  };
}

export async function createPendingItem(input: CreatePendingItemInput): Promise<PendingItem> {
  return withTransaction((db) => createPendingItemInTransaction(db, input, true));
}

export async function createPendingItemInTransaction(
  db: SQLiteDatabase,
  input: CreatePendingItemInput,
  audit = true,
): Promise<PendingItem> {
  assertRequired(input.title, 'Titulo');
  assertRequired(input.type, 'Tipo');

  const timestamp = nowIso();
  const investmentRequired = roundMoney(input.investmentRequired ?? 0);
  const expectedIncome = roundMoney(input.expectedIncome ?? 0);
  const expectedExpense = roundMoney(input.expectedExpense ?? 0);
  const expectedProfit = roundMoney(
    input.expectedProfit ?? expectedIncome - expectedExpense - investmentRequired,
  );

  const item: PendingItem = {
    id: createId('pen'),
    title: input.title.trim(),
    type: input.type,
    status: input.status ?? 'pendiente',
    created_date: input.createdDate ?? todayDbDate(),
    expected_date: input.expectedDate ?? null,
    account_id: input.accountId ?? null,
    related_bet_id: input.relatedBetId ?? null,
    related_matched_bet_id: input.relatedMatchedBetId ?? null,
    related_transaction_id: input.relatedTransactionId ?? null,
    investment_required: investmentRequired,
    expected_income: expectedIncome,
    expected_expense: expectedExpense,
    expected_profit: expectedProfit,
    actual_profit: roundMoney(input.actualProfit ?? 0),
    priority: input.priority ?? 2,
    recurrence: input.recurrence ?? null,
    notes: input.notes ?? null,
    import_hash: input.importHash ?? null,
    created_at: timestamp,
    updated_at: timestamp,
  };

  await insertPendingItem(db, item);

  if (audit) {
    await createAuditLog(db, {
      action: 'create',
      tableName: 'pending_items',
      recordId: item.id,
      newValue: item,
    });
  }

  return item;
}

export async function updatePendingItem(input: UpdatePendingItemInput): Promise<PendingItem> {
  assertRequired(input.id, 'Pendiente');

  return withTransaction(async (db) => {
    const previous = await db.getFirstAsync<PendingItem>(
      'SELECT * FROM pending_items WHERE id = ?',
      [input.id],
    );

    if (!previous) {
      throw new Error('Pendiente no encontrado.');
    }

    const investmentRequired = roundMoney(
      input.investmentRequired ?? previous.investment_required,
    );
    const expectedIncome = roundMoney(input.expectedIncome ?? previous.expected_income);
    const expectedExpense = roundMoney(input.expectedExpense ?? previous.expected_expense);

    const next: PendingItem = {
      ...previous,
      title: input.title !== undefined ? input.title.trim() : previous.title,
      type: input.type ?? previous.type,
      status: input.status ?? previous.status,
      created_date: input.createdDate ?? previous.created_date,
      expected_date: input.expectedDate !== undefined ? input.expectedDate : previous.expected_date,
      account_id: input.accountId !== undefined ? input.accountId : previous.account_id,
      related_bet_id:
        input.relatedBetId !== undefined ? input.relatedBetId : previous.related_bet_id,
      related_matched_bet_id:
        input.relatedMatchedBetId !== undefined
          ? input.relatedMatchedBetId
          : previous.related_matched_bet_id,
      related_transaction_id:
        input.relatedTransactionId !== undefined
          ? input.relatedTransactionId
          : previous.related_transaction_id,
      investment_required: investmentRequired,
      expected_income: expectedIncome,
      expected_expense: expectedExpense,
      expected_profit: roundMoney(
        input.expectedProfit ?? expectedIncome - expectedExpense - investmentRequired,
      ),
      actual_profit: roundMoney(input.actualProfit ?? previous.actual_profit),
      priority: input.priority ?? previous.priority,
      recurrence: input.recurrence !== undefined ? input.recurrence : previous.recurrence,
      notes: input.notes !== undefined ? input.notes : previous.notes,
      updated_at: nowIso(),
    };

    await db.runAsync(
      `UPDATE pending_items
       SET title = ?, type = ?, status = ?, created_date = ?, expected_date = ?,
           account_id = ?, related_bet_id = ?, related_matched_bet_id = ?,
           related_transaction_id = ?, investment_required = ?, expected_income = ?,
           expected_expense = ?, expected_profit = ?, actual_profit = ?, priority = ?,
           recurrence = ?, notes = ?, updated_at = ?
       WHERE id = ?`,
      sqlParams([
        next.title,
        next.type,
        next.status,
        next.created_date,
        next.expected_date,
        next.account_id,
        next.related_bet_id,
        next.related_matched_bet_id,
        next.related_transaction_id,
        next.investment_required,
        next.expected_income,
        next.expected_expense,
        next.expected_profit,
        next.actual_profit,
        next.priority,
        next.recurrence,
        next.notes,
        next.updated_at,
        next.id,
      ]),
    );

    await createAuditLog(db, {
      action: 'update',
      tableName: 'pending_items',
      recordId: next.id,
      oldValue: previous,
      newValue: next,
    });

    return next;
  });
}

export async function setPendingItemStatus(
  id: string,
  status: PendingItemStatus,
  actualProfit?: number,
): Promise<PendingItem> {
  return updatePendingItem({ id, status, actualProfit });
}

export async function completePendingItemForMatchedBet(
  db: SQLiteDatabase,
  matchedBet: MatchedBet,
): Promise<void> {
  const rows = await db.getAllAsync<PendingItem>(
    `SELECT * FROM pending_items
     WHERE related_matched_bet_id = ?
       AND status IN ('pendiente', 'en_curso', 'vencido')`,
    [matchedBet.id],
  );

  for (const row of rows) {
    const next: PendingItem = {
      ...row,
      status: 'completado',
      actual_profit: matchedBet.actual_profit,
      updated_at: nowIso(),
    };

    await db.runAsync(
      `UPDATE pending_items
       SET status = ?, actual_profit = ?, updated_at = ?
       WHERE id = ?`,
      [next.status, next.actual_profit, next.updated_at, next.id],
    );

    await createAuditLog(db, {
      action: 'update',
      tableName: 'pending_items',
      recordId: next.id,
      oldValue: row,
      newValue: next,
    });
  }
}

export async function deletePendingItem(id: string): Promise<void> {
  assertRequired(id, 'Pendiente');

  await withTransaction(async (db) => {
    const previous = await db.getFirstAsync<PendingItem>(
      'SELECT * FROM pending_items WHERE id = ?',
      [id],
    );

    if (!previous) {
      return;
    }

    await db.runAsync('DELETE FROM pending_items WHERE id = ?', [id]);
    await createAuditLog(db, {
      action: 'delete',
      tableName: 'pending_items',
      recordId: id,
      oldValue: previous,
    });
  });
}

function insertPendingItem(db: SQLiteDatabase, item: PendingItem): Promise<unknown> {
  return db.runAsync(
    `INSERT INTO pending_items
      (id, title, type, status, created_date, expected_date, account_id,
       related_bet_id, related_matched_bet_id, related_transaction_id,
       investment_required, expected_income, expected_expense, expected_profit,
       actual_profit, priority, recurrence, notes, import_hash, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    sqlParams([
      item.id,
      item.title,
      item.type,
      item.status,
      item.created_date,
      item.expected_date,
      item.account_id,
      item.related_bet_id,
      item.related_matched_bet_id,
      item.related_transaction_id,
      item.investment_required,
      item.expected_income,
      item.expected_expense,
      item.expected_profit,
      item.actual_profit,
      item.priority,
      item.recurrence,
      item.notes,
      item.import_hash,
      item.created_at,
      item.updated_at,
    ]),
  );
}

async function sumSql(sql: string, params: unknown[] = []): Promise<number> {
  const row = await getFirst<SumRow>(sql, params);
  return roundMoney(row?.total ?? 0);
}

async function countSql(sql: string, params: unknown[] = []): Promise<number> {
  const row = await getFirst<CountRow>(sql, params);
  return row?.total ?? 0;
}

function addDays(dbDate: string, days: number): string {
  const [year, month, day] = dbDate.split('-').map(Number);
  const date = new Date(year, month - 1, day + days);
  return date.toISOString().slice(0, 10);
}
