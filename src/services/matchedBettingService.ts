import type { SQLiteDatabase } from 'expo-sqlite';

import { createAuditLog } from '../db/repositories/auditLogRepository';
import { getAll, getFirst, withTransaction } from '../db/database';
import type {
  ListFilter,
  MatchedBet,
  MatchedBetResult,
  MatchedOfferType,
  Transaction,
} from '../domain/types';
import {
  assertDifferentAccounts,
  assertOdds,
  assertPositiveAmount,
  assertRequired,
} from '../domain/validators';
import { nowIso, todayDbDate } from '../utils/dates';
import { createId } from '../utils/ids';
import { roundMoney } from '../utils/money';
import {
  applyAccountDelta,
  insertTransactionWithBalance,
} from './transactionService';
import {
  calculateMatchedExpected,
  calculateMatchedSettlement,
} from './calculations';

export interface CreateMatchedBetInput {
  date?: string;
  event: string;
  sport?: string | null;
  bookmakerAccountId: string;
  exchangeAccountId: string;
  source?: string | null;
  offerType: MatchedOfferType;
  backSelection?: string | null;
  backOdds: number;
  backStake: number;
  layOdds: number;
  layStake: number;
  layCommission?: number;
  freebetAmount?: number;
  notes?: string | null;
  importHash?: string | null;
}

export interface UpdatePendingMatchedBetInput extends Partial<CreateMatchedBetInput> {
  id: string;
}

export interface SettleMatchedBetInput {
  id: string;
  result: MatchedBetResult;
  manualBookmakerAmount?: number;
  manualExchangeAmount?: number;
  notes?: string | null;
}

export async function listMatchedBets(filter: ListFilter = {}): Promise<MatchedBet[]> {
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
    where.push('(event LIKE ? OR sport LIKE ? OR source LIKE ? OR notes LIKE ?)');
    const text = `%${filter.text}%`;
    params.push(text, text, text, text);
  }

  if (filter.profitSign === 'positive') {
    where.push('actual_profit > 0');
  }

  if (filter.profitSign === 'negative') {
    where.push('actual_profit < 0');
  }

  const sql = `SELECT * FROM matched_bets
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY date DESC, created_at DESC`;

  return getAll<MatchedBet>(sql, params);
}

export async function getMatchedBetById(id: string): Promise<MatchedBet | null> {
  return getFirst<MatchedBet>('SELECT * FROM matched_bets WHERE id = ?', [id]);
}

export async function createMatchedBet(input: CreateMatchedBetInput): Promise<MatchedBet> {
  validateMatchedBetInput(input);

  return withTransaction(async (db) => {
    const timestamp = nowIso();
    const expected = calculateMatchedExpected({
      offerType: input.offerType,
      backOdds: input.backOdds,
      backStake: input.backStake,
      layOdds: input.layOdds,
      layStake: input.layStake,
      layCommission: input.layCommission ?? 0,
      freebetAmount: input.freebetAmount ?? 0,
    });

    const matchedBet: MatchedBet = {
      id: createId('mb'),
      date: input.date ?? todayDbDate(),
      event: input.event.trim(),
      sport: input.sport ?? null,
      bookmaker_account_id: input.bookmakerAccountId,
      exchange_account_id: input.exchangeAccountId,
      source: input.source ?? null,
      offer_type: input.offerType,
      back_selection: input.backSelection ?? null,
      back_odds: roundMoney(input.backOdds),
      back_stake: roundMoney(input.backStake),
      lay_odds: roundMoney(input.layOdds),
      lay_stake: roundMoney(input.layStake),
      lay_commission: roundMoney(input.layCommission ?? 0),
      lay_liability: expected.layLiability,
      freebet_amount: roundMoney(input.freebetAmount ?? 0),
      expected_profit: expected.expectedProfit,
      actual_profit: 0,
      expected_actual_diff: 0,
      roi: expected.roi,
      status: 'pendiente',
      result: null,
      settled_at: null,
      notes: input.notes ?? null,
      import_hash: input.importHash ?? null,
      created_at: timestamp,
      updated_at: timestamp,
    };

    await insertMatchedBet(db, matchedBet);
    await insertMatchedBetOpeningTransactions(db, matchedBet);

    await createAuditLog(db, {
      action: 'create',
      tableName: 'matched_bets',
      recordId: matchedBet.id,
      newValue: matchedBet,
    });

    return matchedBet;
  });
}

export async function updatePendingMatchedBet(
  input: UpdatePendingMatchedBetInput,
): Promise<MatchedBet> {
  assertRequired(input.id, 'Matched bet');

  return withTransaction(async (db) => {
    const previous = await db.getFirstAsync<MatchedBet>(
      'SELECT * FROM matched_bets WHERE id = ?',
      [input.id],
    );

    if (!previous) {
      throw new Error('Matched bet no encontrada.');
    }

    if (previous.status !== 'pendiente') {
      throw new Error('La matched bet ya esta liquidada. Corrige o reabre antes de editar importes.');
    }

    const nextInput: CreateMatchedBetInput = {
      date: input.date ?? previous.date,
      event: input.event ?? previous.event,
      sport: input.sport !== undefined ? input.sport : previous.sport,
      bookmakerAccountId: input.bookmakerAccountId ?? previous.bookmaker_account_id,
      exchangeAccountId: input.exchangeAccountId ?? previous.exchange_account_id,
      source: input.source !== undefined ? input.source : previous.source,
      offerType: input.offerType ?? previous.offer_type,
      backSelection:
        input.backSelection !== undefined ? input.backSelection : previous.back_selection,
      backOdds: input.backOdds ?? previous.back_odds,
      backStake: input.backStake ?? previous.back_stake,
      layOdds: input.layOdds ?? previous.lay_odds,
      layStake: input.layStake ?? previous.lay_stake,
      layCommission: input.layCommission ?? previous.lay_commission,
      freebetAmount: input.freebetAmount ?? previous.freebet_amount,
      notes: input.notes !== undefined ? input.notes : previous.notes,
      importHash: previous.import_hash,
    };

    validateMatchedBetInput(nextInput);
    await deleteLinkedMatchedTransactions(db, previous.id);

    const expected = calculateMatchedExpected({
      offerType: nextInput.offerType,
      backOdds: nextInput.backOdds,
      backStake: nextInput.backStake,
      layOdds: nextInput.layOdds,
      layStake: nextInput.layStake,
      layCommission: nextInput.layCommission ?? 0,
      freebetAmount: nextInput.freebetAmount ?? 0,
    });

    const next: MatchedBet = {
      ...previous,
      date: nextInput.date ?? previous.date,
      event: nextInput.event.trim(),
      sport: nextInput.sport ?? null,
      bookmaker_account_id: nextInput.bookmakerAccountId,
      exchange_account_id: nextInput.exchangeAccountId,
      source: nextInput.source ?? null,
      offer_type: nextInput.offerType,
      back_selection: nextInput.backSelection ?? null,
      back_odds: roundMoney(nextInput.backOdds),
      back_stake: roundMoney(nextInput.backStake),
      lay_odds: roundMoney(nextInput.layOdds),
      lay_stake: roundMoney(nextInput.layStake),
      lay_commission: roundMoney(nextInput.layCommission ?? 0),
      lay_liability: expected.layLiability,
      freebet_amount: roundMoney(nextInput.freebetAmount ?? 0),
      expected_profit: expected.expectedProfit,
      expected_actual_diff: 0,
      roi: expected.roi,
      notes: nextInput.notes ?? null,
      updated_at: nowIso(),
    };

    await db.runAsync(
      `UPDATE matched_bets
       SET date = ?, event = ?, sport = ?, bookmaker_account_id = ?, exchange_account_id = ?,
           source = ?, offer_type = ?, back_selection = ?, back_odds = ?, back_stake = ?,
           lay_odds = ?, lay_stake = ?, lay_commission = ?, lay_liability = ?,
           freebet_amount = ?, expected_profit = ?, expected_actual_diff = ?, roi = ?,
           notes = ?, updated_at = ?
       WHERE id = ?`,
      [
        next.date,
        next.event,
        next.sport,
        next.bookmaker_account_id,
        next.exchange_account_id,
        next.source,
        next.offer_type,
        next.back_selection,
        next.back_odds,
        next.back_stake,
        next.lay_odds,
        next.lay_stake,
        next.lay_commission,
        next.lay_liability,
        next.freebet_amount,
        next.expected_profit,
        next.expected_actual_diff,
        next.roi,
        next.notes,
        next.updated_at,
        next.id,
      ],
    );

    await insertMatchedBetOpeningTransactions(db, next);

    await createAuditLog(db, {
      action: 'update',
      tableName: 'matched_bets',
      recordId: next.id,
      oldValue: previous,
      newValue: next,
    });

    return next;
  });
}

export async function settleMatchedBet(input: SettleMatchedBetInput): Promise<MatchedBet> {
  return withTransaction(async (db) => {
    assertRequired(input.id, 'Matched bet');

    const previous = await db.getFirstAsync<MatchedBet>(
      'SELECT * FROM matched_bets WHERE id = ?',
      [input.id],
    );

    if (!previous) {
      throw new Error('Matched bet no encontrada.');
    }

    await deleteLinkedMatchedTransactions(db, previous.id, ['liquidacion_matched_betting']);

    const settlement = calculateMatchedSettlement({
      offerType: previous.offer_type,
      backOdds: previous.back_odds,
      backStake: previous.back_stake,
      layOdds: previous.lay_odds,
      layStake: previous.lay_stake,
      layCommission: previous.lay_commission,
      freebetAmount: previous.freebet_amount,
      result: input.result,
      manualBookmakerAmount: input.manualBookmakerAmount,
      manualExchangeAmount: input.manualExchangeAmount,
    });

    const timestamp = nowIso();
    const next: MatchedBet = {
      ...previous,
      status: 'liquidada',
      result: input.result,
      actual_profit: settlement.actualProfit,
      expected_actual_diff: settlement.expectedActualDiff,
      roi: settlement.roi,
      settled_at: timestamp,
      notes: input.notes !== undefined ? input.notes : previous.notes,
      updated_at: timestamp,
    };

    await db.runAsync(
      `UPDATE matched_bets
       SET status = ?, result = ?, actual_profit = ?, expected_actual_diff = ?,
           roi = ?, settled_at = ?, notes = ?, updated_at = ?
       WHERE id = ?`,
      [
        next.status,
        next.result,
        next.actual_profit,
        next.expected_actual_diff,
        next.roi,
        next.settled_at,
        next.notes,
        next.updated_at,
        next.id,
      ],
    );

    if (settlement.bookmakerLiquidationAmount !== 0) {
      await insertTransactionWithBalance(
        db,
        {
          date: todayDbDate(),
          accountId: previous.bookmaker_account_id,
          type: 'liquidacion_matched_betting',
          amount: settlement.bookmakerLiquidationAmount,
          category: 'liquidacion matched betting',
          description: `Liquidacion matched betting: ${previous.event}`,
          relatedMatchedBetId: previous.id,
          notes: next.notes,
        },
        false,
      );
    }

    if (settlement.exchangeLiquidationAmount !== 0) {
      await insertTransactionWithBalance(
        db,
        {
          date: todayDbDate(),
          accountId: previous.exchange_account_id,
          type: 'liquidacion_matched_betting',
          amount: settlement.exchangeLiquidationAmount,
          category: 'liquidacion matched betting',
          description: `Liquidacion exchange: ${previous.event}`,
          relatedMatchedBetId: previous.id,
          notes: next.notes,
        },
        false,
      );
    }

    await createAuditLog(db, {
      action: 'update',
      tableName: 'matched_bets',
      recordId: next.id,
      oldValue: previous,
      newValue: next,
    });

    return next;
  });
}

export async function deleteMatchedBet(id: string, force = false): Promise<void> {
  assertRequired(id, 'Matched bet');

  await withTransaction(async (db) => {
    const matchedBet = await db.getFirstAsync<MatchedBet>(
      'SELECT * FROM matched_bets WHERE id = ?',
      [id],
    );

    if (!matchedBet) {
      return;
    }

    const linkedTransactions = await db.getAllAsync<Transaction>(
      'SELECT * FROM transactions WHERE related_matched_bet_id = ?',
      [id],
    );

    if (linkedTransactions.length > 0 && !force) {
      throw new Error('La matched bet tiene movimientos asociados. Confirma el borrado para revertirlos.');
    }

    await deleteLinkedMatchedTransactions(db, id);
    await db.runAsync('DELETE FROM matched_bets WHERE id = ?', [id]);
    await createAuditLog(db, {
      action: 'delete',
      tableName: 'matched_bets',
      recordId: id,
      oldValue: { matchedBet, linkedTransactions },
    });
  });
}

async function insertMatchedBet(db: SQLiteDatabase, matchedBet: MatchedBet): Promise<void> {
  await db.runAsync(
    `INSERT INTO matched_bets
      (id, date, event, sport, bookmaker_account_id, exchange_account_id, source,
       offer_type, back_selection, back_odds, back_stake, lay_odds, lay_stake,
       lay_commission, lay_liability, freebet_amount, expected_profit,
       actual_profit, expected_actual_diff, roi, status, result, settled_at,
       notes, import_hash, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      matchedBet.id,
      matchedBet.date,
      matchedBet.event,
      matchedBet.sport,
      matchedBet.bookmaker_account_id,
      matchedBet.exchange_account_id,
      matchedBet.source,
      matchedBet.offer_type,
      matchedBet.back_selection,
      matchedBet.back_odds,
      matchedBet.back_stake,
      matchedBet.lay_odds,
      matchedBet.lay_stake,
      matchedBet.lay_commission,
      matchedBet.lay_liability,
      matchedBet.freebet_amount,
      matchedBet.expected_profit,
      matchedBet.actual_profit,
      matchedBet.expected_actual_diff,
      matchedBet.roi,
      matchedBet.status,
      matchedBet.result,
      matchedBet.settled_at,
      matchedBet.notes,
      matchedBet.import_hash,
      matchedBet.created_at,
      matchedBet.updated_at,
    ],
  );
}

async function insertMatchedBetOpeningTransactions(
  db: SQLiteDatabase,
  matchedBet: MatchedBet,
): Promise<void> {
  const isFreebet = matchedBet.offer_type === 'freebet' || matchedBet.freebet_amount > 0;
  const cashBackStake = isFreebet
    ? Math.max(0, roundMoney(matchedBet.back_stake - matchedBet.freebet_amount))
    : matchedBet.back_stake;

  if (cashBackStake > 0) {
    await insertTransactionWithBalance(
      db,
      {
        date: matchedBet.date,
        accountId: matchedBet.bookmaker_account_id,
        type: 'stake_back',
        amount: cashBackStake,
        category: 'stake back',
        description: `Stake back: ${matchedBet.event}`,
        relatedMatchedBetId: matchedBet.id,
        notes: matchedBet.notes,
      },
      false,
    );
  }

  if (matchedBet.lay_liability > 0) {
    await insertTransactionWithBalance(
      db,
      {
        date: matchedBet.date,
        accountId: matchedBet.exchange_account_id,
        type: 'liability_lay',
        amount: matchedBet.lay_liability,
        category: 'liability lay',
        description: `Responsabilidad lay: ${matchedBet.event}`,
        relatedMatchedBetId: matchedBet.id,
        notes: matchedBet.notes,
      },
      false,
    );
  }
}

async function deleteLinkedMatchedTransactions(
  db: SQLiteDatabase,
  matchedBetId: string,
  onlyTypes?: string[],
): Promise<void> {
  const params: unknown[] = [matchedBetId];
  const typeClause = onlyTypes?.length
    ? `AND type IN (${onlyTypes.map(() => '?').join(', ')})`
    : '';

  if (onlyTypes?.length) {
    params.push(...onlyTypes);
  }

  const linkedTransactions = await db.getAllAsync<Transaction>(
    `SELECT * FROM transactions WHERE related_matched_bet_id = ? ${typeClause}`,
    params as any,
  );

  for (const transaction of linkedTransactions) {
    await applyAccountDelta(db, transaction.account_id, -transaction.amount);
    await db.runAsync('DELETE FROM transactions WHERE id = ?', [transaction.id]);
  }
}

function validateMatchedBetInput(input: CreateMatchedBetInput): void {
  assertRequired(input.event, 'Evento');
  assertRequired(input.bookmakerAccountId, 'Casa de apuestas');
  assertRequired(input.exchangeAccountId, 'Exchange');
  assertDifferentAccounts(input.bookmakerAccountId, input.exchangeAccountId);
  assertRequired(input.offerType, 'Tipo de oferta');
  assertOdds(input.backOdds, 'Cuota back');
  assertOdds(input.layOdds, 'Cuota lay');
  assertPositiveAmount(input.backStake, 'Stake back');
  assertPositiveAmount(input.layStake, 'Stake lay');

  if ((input.layCommission ?? 0) < 0 || (input.layCommission ?? 0) > 100) {
    throw new Error('La comision exchange debe estar entre 0 y 100.');
  }
}
