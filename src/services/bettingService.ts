import type { SQLiteDatabase } from 'expo-sqlite';

import { createAuditLog } from '../db/repositories/auditLogRepository';
import { getAll, getFirst, sqlParams, withTransaction } from '../db/database';
import type { Bet, BetStatus, ListFilter, Transaction } from '../domain/types';
import { assertOdds, assertPositiveAmount, assertRequired } from '../domain/validators';
import { nowIso, todayDbDate } from '../utils/dates';
import { createId } from '../utils/ids';
import { roundMoney } from '../utils/money';
import {
  applyAccountDelta,
  insertTransactionWithBalance,
} from './transactionService';
import { calculateBetPotential, calculateBetSettlement } from './calculations';

export interface CreateBetInput {
  date?: string;
  event: string;
  sport?: string | null;
  competition?: string | null;
  market?: string | null;
  selection?: string | null;
  betDescription: string;
  odds: number;
  stake: number;
  bookmakerAccountId: string;
  source?: string | null;
  status?: BetStatus;
  cashoutAmount?: number;
  notes?: string | null;
  importHash?: string | null;
}

export interface UpdatePendingBetInput extends Partial<CreateBetInput> {
  id: string;
}

export interface UpdateBetInput extends Partial<CreateBetInput> {
  id: string;
  allowSettledEdit?: boolean;
}

export interface SettleBetInput {
  id: string;
  status: Exclude<BetStatus, 'pendiente'>;
  cashoutAmount?: number;
  notes?: string | null;
}

export async function listBets(filter: ListFilter = {}): Promise<Bet[]> {
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

  if (filter.bookmakerAccountId) {
    where.push('bookmaker_account_id = ?');
    params.push(filter.bookmakerAccountId);
  }

  if (filter.source) {
    where.push('source = ?');
    params.push(filter.source);
  }

  if (filter.status) {
    where.push('status = ?');
    params.push(filter.status);
  }

  if (filter.text) {
    where.push(`(
      event LIKE ? OR sport LIKE ? OR competition LIKE ? OR market LIKE ?
      OR selection LIKE ? OR bet_description LIKE ? OR notes LIKE ?
    )`);
    const text = `%${filter.text}%`;
    params.push(text, text, text, text, text, text, text);
  }

  if (filter.profitSign === 'positive') {
    where.push('profit_loss > 0');
  }

  if (filter.profitSign === 'negative') {
    where.push('profit_loss < 0');
  }

  const sql = `SELECT * FROM bets
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY date DESC, created_at DESC`;

  return getAll<Bet>(sql, params);
}

export async function getBetById(id: string): Promise<Bet | null> {
  return getFirst<Bet>('SELECT * FROM bets WHERE id = ?', [id]);
}

export async function createBet(input: CreateBetInput): Promise<Bet> {
  validateBetInput(input);

  return withTransaction(async (db) => {
    const timestamp = nowIso();
    const potential = calculateBetPotential(input.stake, input.odds);
    const bet: Bet = {
      id: createId('bet'),
      date: input.date ?? todayDbDate(),
      event: input.event.trim(),
      sport: input.sport ?? null,
      competition: input.competition ?? null,
      market: input.market ?? null,
      selection: input.selection ?? null,
      bet_description: input.betDescription.trim(),
      odds: roundMoney(input.odds),
      stake: roundMoney(input.stake),
      bookmaker_account_id: input.bookmakerAccountId,
      source: input.source ?? null,
      status: 'pendiente',
      result: null,
      potential_return: potential.potentialReturn,
      potential_profit: potential.potentialProfit,
      profit_loss: 0,
      settled_at: null,
      notes: input.notes ?? null,
      import_hash: input.importHash ?? null,
      created_at: timestamp,
      updated_at: timestamp,
    };

    await insertBet(db, bet);

    await insertTransactionWithBalance(
      db,
      {
        date: bet.date,
        accountId: bet.bookmaker_account_id,
        type: 'stake_apuesta',
        amount: bet.stake,
        category: 'stake apuesta',
        description: `Stake apuesta: ${bet.event}`,
        relatedBetId: bet.id,
        notes: bet.notes,
      },
      false,
    );

    let nextBet = bet;
    if (input.status && input.status !== 'pendiente') {
      nextBet = await settleBetInTransaction(db, {
        id: bet.id,
        status: input.status,
        cashoutAmount: input.cashoutAmount,
        notes: input.notes,
      });
    }

    await createAuditLog(db, {
      action: 'create',
      tableName: 'bets',
      recordId: nextBet.id,
      newValue: nextBet,
    });

    return nextBet;
  });
}

export async function updatePendingBet(input: UpdatePendingBetInput): Promise<Bet> {
  assertRequired(input.id, 'Apuesta');

  return withTransaction(async (db) => {
    const previous = await db.getFirstAsync<Bet>('SELECT * FROM bets WHERE id = ?', [
      input.id,
    ]);

    if (!previous) {
      throw new Error('Apuesta no encontrada.');
    }

    if (previous.status !== 'pendiente') {
      throw new Error('La apuesta ya esta liquidada. Reabre o corrige la liquidacion antes de editar importes.');
    }

    const nextInput: CreateBetInput = {
      date: input.date ?? previous.date,
      event: input.event ?? previous.event,
      sport: input.sport !== undefined ? input.sport : previous.sport,
      competition:
        input.competition !== undefined ? input.competition : previous.competition,
      market: input.market !== undefined ? input.market : previous.market,
      selection: input.selection !== undefined ? input.selection : previous.selection,
      betDescription: input.betDescription ?? previous.bet_description,
      odds: input.odds ?? previous.odds,
      stake: input.stake ?? previous.stake,
      bookmakerAccountId: input.bookmakerAccountId ?? previous.bookmaker_account_id,
      source: input.source !== undefined ? input.source : previous.source,
      notes: input.notes !== undefined ? input.notes : previous.notes,
      importHash: previous.import_hash,
    };

    validateBetInput(nextInput);
    await deleteLinkedTransactions(db, previous.id, ['stake_apuesta']);

    const potential = calculateBetPotential(nextInput.stake, nextInput.odds);
    const next: Bet = {
      ...previous,
      date: nextInput.date ?? previous.date,
      event: nextInput.event.trim(),
      sport: nextInput.sport ?? null,
      competition: nextInput.competition ?? null,
      market: nextInput.market ?? null,
      selection: nextInput.selection ?? null,
      bet_description: nextInput.betDescription.trim(),
      odds: roundMoney(nextInput.odds),
      stake: roundMoney(nextInput.stake),
      bookmaker_account_id: nextInput.bookmakerAccountId,
      source: nextInput.source ?? null,
      potential_return: potential.potentialReturn,
      potential_profit: potential.potentialProfit,
      notes: nextInput.notes ?? null,
      updated_at: nowIso(),
    };

    await db.runAsync(
      `UPDATE bets
       SET date = ?, event = ?, sport = ?, competition = ?, market = ?, selection = ?,
           bet_description = ?, odds = ?, stake = ?, bookmaker_account_id = ?,
           source = ?, potential_return = ?, potential_profit = ?, notes = ?, updated_at = ?
       WHERE id = ?`,
      sqlParams([
        next.date,
        next.event,
        next.sport,
        next.competition,
        next.market,
        next.selection,
        next.bet_description,
        next.odds,
        next.stake,
        next.bookmaker_account_id,
        next.source,
        next.potential_return,
        next.potential_profit,
        next.notes,
        next.updated_at,
        next.id,
      ]),
    );

    await insertTransactionWithBalance(
      db,
      {
        date: next.date,
        accountId: next.bookmaker_account_id,
        type: 'stake_apuesta',
        amount: next.stake,
        category: 'stake apuesta',
        description: `Stake apuesta: ${next.event}`,
        relatedBetId: next.id,
        notes: next.notes,
      },
      false,
    );

    await createAuditLog(db, {
      action: 'update',
      tableName: 'bets',
      recordId: next.id,
      oldValue: previous,
      newValue: next,
    });

    return next;
  });
}

export async function updateBet(input: UpdateBetInput): Promise<Bet> {
  assertRequired(input.id, 'Apuesta');

  return withTransaction(async (db) => {
    const previous = await db.getFirstAsync<Bet>('SELECT * FROM bets WHERE id = ?', [
      input.id,
    ]);

    if (!previous) {
      throw new Error('Apuesta no encontrada.');
    }

    if (previous.status !== 'pendiente' && !input.allowSettledEdit) {
      throw new Error('La apuesta ya esta liquidada. Confirma la edicion para recalcular movimientos.');
    }

    const nextInput: CreateBetInput = {
      date: input.date ?? previous.date,
      event: input.event ?? previous.event,
      sport: input.sport !== undefined ? input.sport : previous.sport,
      competition:
        input.competition !== undefined ? input.competition : previous.competition,
      market: input.market !== undefined ? input.market : previous.market,
      selection: input.selection !== undefined ? input.selection : previous.selection,
      betDescription: input.betDescription ?? previous.bet_description,
      odds: input.odds ?? previous.odds,
      stake: input.stake ?? previous.stake,
      bookmakerAccountId: input.bookmakerAccountId ?? previous.bookmaker_account_id,
      source: input.source !== undefined ? input.source : previous.source,
      notes: input.notes !== undefined ? input.notes : previous.notes,
      importHash: previous.import_hash,
    };

    validateBetInput(nextInput);
    await deleteLinkedTransactions(db, previous.id);

    const potential = calculateBetPotential(nextInput.stake, nextInput.odds);
    let profitLoss = 0;
    let liquidationAmount = 0;
    let settledAt: string | null = null;

    if (previous.status !== 'pendiente') {
      const settlement = calculateBetSettlement({
        status: previous.status,
        stake: nextInput.stake,
        odds: nextInput.odds,
        cashoutAmount:
          previous.status === 'cashout'
            ? input.cashoutAmount ?? previous.profit_loss + nextInput.stake
            : input.cashoutAmount,
      });
      profitLoss = settlement.profitLoss;
      liquidationAmount = settlement.liquidationAmount;
      settledAt = previous.settled_at ?? nowIso();
    }

    const next: Bet = {
      ...previous,
      date: nextInput.date ?? previous.date,
      event: nextInput.event.trim(),
      sport: nextInput.sport ?? null,
      competition: nextInput.competition ?? null,
      market: nextInput.market ?? null,
      selection: nextInput.selection ?? null,
      bet_description: nextInput.betDescription.trim(),
      odds: roundMoney(nextInput.odds),
      stake: roundMoney(nextInput.stake),
      bookmaker_account_id: nextInput.bookmakerAccountId,
      source: nextInput.source ?? null,
      potential_return: potential.potentialReturn,
      potential_profit: potential.potentialProfit,
      profit_loss: profitLoss,
      settled_at: settledAt,
      notes: nextInput.notes ?? null,
      updated_at: nowIso(),
    };

    await db.runAsync(
      `UPDATE bets
       SET date = ?, event = ?, sport = ?, competition = ?, market = ?, selection = ?,
           bet_description = ?, odds = ?, stake = ?, bookmaker_account_id = ?,
           source = ?, potential_return = ?, potential_profit = ?, profit_loss = ?,
           settled_at = ?, notes = ?, updated_at = ?
       WHERE id = ?`,
      sqlParams([
        next.date,
        next.event,
        next.sport,
        next.competition,
        next.market,
        next.selection,
        next.bet_description,
        next.odds,
        next.stake,
        next.bookmaker_account_id,
        next.source,
        next.potential_return,
        next.potential_profit,
        next.profit_loss,
        next.settled_at,
        next.notes,
        next.updated_at,
        next.id,
      ]),
    );

    await insertTransactionWithBalance(
      db,
      {
        date: next.date,
        accountId: next.bookmaker_account_id,
        type: 'stake_apuesta',
        amount: next.stake,
        category: 'stake apuesta',
        description: `Stake apuesta: ${next.event}`,
        relatedBetId: next.id,
        notes: next.notes,
      },
      false,
    );

    if (liquidationAmount !== 0) {
      await insertTransactionWithBalance(
        db,
        {
          date: next.settled_at?.slice(0, 10) ?? todayDbDate(),
          accountId: next.bookmaker_account_id,
          type: 'liquidacion_apuesta',
          amount: liquidationAmount,
          category: 'liquidacion apuesta',
          description: `Liquidacion apuesta: ${next.event}`,
          relatedBetId: next.id,
          notes: next.notes,
        },
        false,
      );
    }

    await createAuditLog(db, {
      action: 'update',
      tableName: 'bets',
      recordId: next.id,
      oldValue: previous,
      newValue: next,
    });

    return next;
  });
}

export async function settleBet(input: SettleBetInput): Promise<Bet> {
  return withTransaction((db) => settleBetInTransaction(db, input));
}

export async function deleteBet(id: string, force = false): Promise<void> {
  assertRequired(id, 'Apuesta');

  await withTransaction(async (db) => {
    const bet = await db.getFirstAsync<Bet>('SELECT * FROM bets WHERE id = ?', [id]);

    if (!bet) {
      return;
    }

    const linkedTransactions = await db.getAllAsync<Transaction>(
      'SELECT * FROM transactions WHERE related_bet_id = ?',
      [id],
    );

    if (linkedTransactions.length > 0 && !force) {
      throw new Error('La apuesta tiene movimientos asociados. Confirma el borrado para revertirlos.');
    }

    await deleteLinkedTransactions(db, id);
    await db.runAsync('DELETE FROM bets WHERE id = ?', [id]);
    await createAuditLog(db, {
      action: 'delete',
      tableName: 'bets',
      recordId: id,
      oldValue: { bet, linkedTransactions },
    });
  });
}

async function settleBetInTransaction(
  db: SQLiteDatabase,
  input: SettleBetInput,
): Promise<Bet> {
  assertRequired(input.id, 'Apuesta');

  const previous = await db.getFirstAsync<Bet>('SELECT * FROM bets WHERE id = ?', [
    input.id,
  ]);

  if (!previous) {
    throw new Error('Apuesta no encontrada.');
  }

  await deleteLinkedTransactions(db, previous.id, ['liquidacion_apuesta']);

  const settlement = calculateBetSettlement({
    status: input.status,
    stake: previous.stake,
    odds: previous.odds,
    cashoutAmount: input.cashoutAmount,
  });

  const timestamp = nowIso();
  const next: Bet = {
    ...previous,
    status: input.status,
    result: input.status,
    profit_loss: settlement.profitLoss,
    settled_at: timestamp,
    notes: input.notes !== undefined ? input.notes : previous.notes,
    updated_at: timestamp,
  };

  await db.runAsync(
    `UPDATE bets
     SET status = ?, result = ?, profit_loss = ?, settled_at = ?, notes = ?, updated_at = ?
     WHERE id = ?`,
    sqlParams([
      next.status,
      next.result,
      next.profit_loss,
      next.settled_at,
      next.notes,
      next.updated_at,
      next.id,
    ]),
  );

  if (settlement.liquidationAmount !== 0) {
    await insertTransactionWithBalance(
      db,
      {
        date: todayDbDate(),
        accountId: next.bookmaker_account_id,
        type: 'liquidacion_apuesta',
        amount: settlement.liquidationAmount,
        category: 'liquidacion apuesta',
        description: `Liquidacion apuesta: ${next.event}`,
        relatedBetId: next.id,
        notes: next.notes,
      },
      false,
    );
  }

  await createAuditLog(db, {
    action: 'update',
    tableName: 'bets',
    recordId: next.id,
    oldValue: previous,
    newValue: next,
  });

  return next;
}

async function insertBet(db: SQLiteDatabase, bet: Bet): Promise<void> {
  await db.runAsync(
    `INSERT INTO bets
      (id, date, event, sport, competition, market, selection, bet_description,
       odds, stake, bookmaker_account_id, source, status, result,
       potential_return, potential_profit, profit_loss, settled_at, notes,
       import_hash, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    sqlParams([
      bet.id,
      bet.date,
      bet.event,
      bet.sport,
      bet.competition,
      bet.market,
      bet.selection,
      bet.bet_description,
      bet.odds,
      bet.stake,
      bet.bookmaker_account_id,
      bet.source,
      bet.status,
      bet.result,
      bet.potential_return,
      bet.potential_profit,
      bet.profit_loss,
      bet.settled_at,
      bet.notes,
      bet.import_hash,
      bet.created_at,
      bet.updated_at,
    ]),
  );
}

async function deleteLinkedTransactions(
  db: SQLiteDatabase,
  betId: string,
  onlyTypes?: string[],
): Promise<void> {
  const params: unknown[] = [betId];
  const typeClause = onlyTypes?.length
    ? `AND type IN (${onlyTypes.map(() => '?').join(', ')})`
    : '';

  if (onlyTypes?.length) {
    params.push(...onlyTypes);
  }

  const linkedTransactions = await db.getAllAsync<Transaction>(
    `SELECT * FROM transactions WHERE related_bet_id = ? ${typeClause}`,
    params as any,
  );

  for (const transaction of linkedTransactions) {
    await applyAccountDelta(db, transaction.account_id, -transaction.amount);
    await db.runAsync('DELETE FROM transactions WHERE id = ?', [transaction.id]);
  }
}

function validateBetInput(input: CreateBetInput): void {
  assertRequired(input.event, 'Evento');
  assertRequired(input.betDescription, 'Apuesta');
  assertRequired(input.bookmakerAccountId, 'Casa de apuestas');
  assertOdds(input.odds);
  assertPositiveAmount(input.stake, 'Dinero apostado');
}
