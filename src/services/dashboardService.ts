import { getFirst } from '../db/database';
import type { DashboardSummary } from '../domain/types';
import { endOfMonthDbDate, startOfMonthDbDate } from '../utils/dates';
import { roundMoney } from '../utils/money';
import { calculateRoi } from './calculations';

interface SumRow {
  total: number | null;
}

interface CountRow {
  total: number | null;
}

interface ProfitStakeRow {
  profit: number | null;
  stake: number | null;
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const monthStart = startOfMonthDbDate();
  const monthEnd = endOfMonthDbDate();

  const capital = await sumSql('SELECT SUM(current_balance) AS total FROM accounts');
  const blockedBets = await sumSql(
    `SELECT SUM(stake) AS total
     FROM bets
     WHERE status = 'pendiente'`,
  );
  const blockedMatched = await sumSql(
    `SELECT SUM(back_stake + lay_liability) AS total
     FROM matched_bets
     WHERE status = 'pendiente'`,
  );
  const monthIncome = await sumSql(
    `SELECT SUM(amount) AS total
     FROM transactions
     WHERE type = 'ingreso' AND date BETWEEN ? AND ?`,
    [monthStart, monthEnd],
  );
  const monthExpense = await sumSql(
    `SELECT SUM(amount) AS total
     FROM transactions
     WHERE type = 'gasto' AND date BETWEEN ? AND ?`,
    [monthStart, monthEnd],
  );
  const monthBetProfit = await sumSql(
    `SELECT SUM(profit_loss) AS total
     FROM bets
     WHERE status <> 'pendiente' AND date BETWEEN ? AND ?`,
    [monthStart, monthEnd],
  );
  const monthMatchedProfit = await sumSql(
    `SELECT SUM(actual_profit) AS total
     FROM matched_bets
     WHERE status = 'liquidada' AND date BETWEEN ? AND ?`,
    [monthStart, monthEnd],
  );
  const pendingBets = await countSql(
    `SELECT COUNT(*) AS total
     FROM bets
     WHERE status = 'pendiente'`,
  );
  const betRoiRow = await getFirst<ProfitStakeRow>(
    `SELECT SUM(profit_loss) AS profit, SUM(stake) AS stake
     FROM bets
     WHERE status <> 'pendiente'`,
  );
  const matchedRoiRow = await getFirst<ProfitStakeRow>(
    `SELECT SUM(actual_profit) AS profit, SUM(back_stake + lay_liability) AS stake
     FROM matched_bets
     WHERE status = 'liquidada'`,
  );

  return {
    capital_total: capital,
    capital_disponible: roundMoney(capital - blockedBets - blockedMatched),
    dinero_bloqueado_apuestas: blockedBets,
    dinero_bloqueado_matched_betting: blockedMatched,
    saldo_real_estimado: capital,
    ingresos_mes: monthIncome,
    gastos_mes: Math.abs(monthExpense),
    apuestas_profit_loss_mes: monthBetProfit,
    matched_profit_loss_mes: monthMatchedProfit,
    apuestas_pendientes: pendingBets,
    roi_apuestas: calculateRoi(betRoiRow?.profit ?? 0, betRoiRow?.stake ?? 0),
    roi_matched_betting: calculateRoi(
      matchedRoiRow?.profit ?? 0,
      matchedRoiRow?.stake ?? 0,
    ),
  };
}

async function sumSql(sql: string, params: unknown[] = []): Promise<number> {
  const row = await getFirst<SumRow>(sql, params);
  return roundMoney(row?.total ?? 0);
}

async function countSql(sql: string, params: unknown[] = []): Promise<number> {
  const row = await getFirst<CountRow>(sql, params);
  return row?.total ?? 0;
}
