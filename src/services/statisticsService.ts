import { getAll, getFirst } from '../db/database';
import { roundMoney } from '../utils/money';
import { calculateRoi } from './calculations';

export interface MonthlyStat {
  month: string;
  ingresos: number;
  gastos: number;
  beneficio_neto: number;
  apuestas_profit_loss: number;
  matched_profit_loss: number;
  capital_estimado: number;
}

export interface RoiStat {
  label: string;
  profit: number;
  stake: number;
  roi: number;
}

export interface BetCountStat {
  status: string;
  count: number;
}

export interface TopBetStat {
  id: string;
  date: string;
  event: string;
  profit_loss: number;
}

export interface AdvancedStatistics {
  monthly: MonthlyStat[];
  roiByBookmaker: RoiStat[];
  roiBySource: RoiStat[];
  roiBySport: RoiStat[];
  betCounts: BetCountStat[];
  topBestBets: TopBetStat[];
  topWorstBets: TopBetStat[];
  totalRoi: number;
  currentBlockedMoney: number;
  matchedExpectedActualDiff: number;
  pendingExpectedProfitMonth: number;
  pendingExpectedProfitTotal: number;
  pendingCompletedCount: number;
  pendingCancelledCount: number;
  projectedCapitalWithPending: number;
}

interface MonthlyRow {
  month: string;
  ingresos: number | null;
  gastos: number | null;
  beneficio_neto: number | null;
}

interface ProfitStakeRow {
  label: string | null;
  profit: number | null;
  stake: number | null;
}

export async function getAdvancedStatistics(): Promise<AdvancedStatistics> {
  const [monthlyBase, monthlyBets, monthlyMatched] = await Promise.all([
    getAll<MonthlyRow>(
      `SELECT substr(date, 1, 7) AS month,
              SUM(CASE WHEN type = 'ingreso' THEN amount ELSE 0 END) AS ingresos,
              SUM(CASE WHEN type = 'gasto' THEN ABS(amount) ELSE 0 END) AS gastos,
              SUM(amount) AS beneficio_neto
       FROM transactions
       GROUP BY substr(date, 1, 7)
       ORDER BY month ASC`,
    ),
    getAll<{ month: string; total: number | null }>(
      `SELECT substr(date, 1, 7) AS month, SUM(profit_loss) AS total
       FROM bets
       WHERE status <> 'pendiente'
       GROUP BY substr(date, 1, 7)`,
    ),
    getAll<{ month: string; total: number | null }>(
      `SELECT substr(date, 1, 7) AS month, SUM(actual_profit) AS total
       FROM matched_bets
       WHERE status = 'liquidada'
       GROUP BY substr(date, 1, 7)`,
    ),
  ]);

  const monthMap = new Map<string, MonthlyStat>();
  for (const row of monthlyBase) {
    monthMap.set(row.month, {
      month: row.month,
      ingresos: roundMoney(row.ingresos ?? 0),
      gastos: roundMoney(row.gastos ?? 0),
      beneficio_neto: roundMoney(row.beneficio_neto ?? 0),
      apuestas_profit_loss: 0,
      matched_profit_loss: 0,
      capital_estimado: 0,
    });
  }

  for (const row of monthlyBets) {
    const current = ensureMonth(monthMap, row.month);
    current.apuestas_profit_loss = roundMoney(row.total ?? 0);
  }

  for (const row of monthlyMatched) {
    const current = ensureMonth(monthMap, row.month);
    current.matched_profit_loss = roundMoney(row.total ?? 0);
  }

  let runningCapital = 0;
  const monthly = [...monthMap.values()].sort((a, b) => a.month.localeCompare(b.month));
  for (const row of monthly) {
    runningCapital = roundMoney(
      runningCapital + row.beneficio_neto + row.apuestas_profit_loss + row.matched_profit_loss,
    );
    row.capital_estimado = runningCapital;
  }

  const [
    roiByBookmaker,
    roiBySource,
    roiBySport,
    betCounts,
    topBestBets,
    topWorstBets,
    totalExposure,
    blockedMoney,
    matchedDiff,
    pendingMonth,
    pendingTotal,
    pendingCompleted,
    pendingCancelled,
    currentCapital,
  ] = await Promise.all([
    getRoiStats(
      `SELECT COALESCE(a.name, 'Sin cuenta') AS label, SUM(b.profit_loss) AS profit, SUM(b.stake) AS stake
       FROM bets b
       LEFT JOIN accounts a ON a.id = b.bookmaker_account_id
       WHERE b.status <> 'pendiente'
       GROUP BY b.bookmaker_account_id
       ORDER BY profit DESC`,
    ),
    getRoiStats(
      `SELECT COALESCE(source, 'Sin origen') AS label, SUM(profit_loss) AS profit, SUM(stake) AS stake
       FROM bets
       WHERE status <> 'pendiente'
       GROUP BY COALESCE(source, 'Sin origen')
       ORDER BY profit DESC`,
    ),
    getRoiStats(
      `SELECT COALESCE(sport, 'Sin deporte') AS label, SUM(profit_loss) AS profit, SUM(stake) AS stake
       FROM bets
       WHERE status <> 'pendiente'
       GROUP BY COALESCE(sport, 'Sin deporte')
       ORDER BY profit DESC`,
    ),
    getAll<BetCountStat>(
      `SELECT status, COUNT(*) AS count
       FROM bets
       GROUP BY status
       ORDER BY count DESC`,
    ),
    getAll<TopBetStat>(
      `SELECT id, date, event, profit_loss
       FROM bets
       WHERE status <> 'pendiente'
       ORDER BY profit_loss DESC
       LIMIT 5`,
    ),
    getAll<TopBetStat>(
      `SELECT id, date, event, profit_loss
       FROM bets
       WHERE status <> 'pendiente'
       ORDER BY profit_loss ASC
       LIMIT 5`,
    ),
    getFirst<{ profit: number | null; stake: number | null }>(
      `SELECT
        COALESCE((SELECT SUM(profit_loss) FROM bets WHERE status <> 'pendiente'), 0) +
        COALESCE((SELECT SUM(actual_profit) FROM matched_bets WHERE status = 'liquidada'), 0) AS profit,
        COALESCE((SELECT SUM(stake) FROM bets WHERE status <> 'pendiente'), 0) +
        COALESCE((SELECT SUM(back_stake + lay_liability) FROM matched_bets WHERE status = 'liquidada'), 0) AS stake`,
    ),
    getFirst<{ total: number | null }>(
      `SELECT
        COALESCE((SELECT SUM(stake) FROM bets WHERE status = 'pendiente'), 0) +
        COALESCE((SELECT SUM(back_stake + lay_liability) FROM matched_bets WHERE status = 'pendiente'), 0)
        AS total`,
    ),
    getFirst<{ total: number | null }>(
      `SELECT SUM(expected_actual_diff) AS total
       FROM matched_bets
       WHERE status = 'liquidada'`,
    ),
    getFirst<{ total: number | null }>(
      `SELECT SUM(expected_profit) AS total
       FROM pending_items
       WHERE status IN ('pendiente', 'en_curso', 'vencido')
         AND expected_date BETWEEN date('now', 'start of month') AND date('now', 'start of month', '+1 month', '-1 day')`,
    ),
    getFirst<{ total: number | null }>(
      `SELECT SUM(expected_profit) AS total
       FROM pending_items
       WHERE status IN ('pendiente', 'en_curso', 'vencido')`,
    ),
    getFirst<{ total: number | null }>(
      `SELECT COUNT(*) AS total FROM pending_items WHERE status = 'completado'`,
    ),
    getFirst<{ total: number | null }>(
      `SELECT COUNT(*) AS total FROM pending_items WHERE status = 'cancelado'`,
    ),
    getFirst<{ total: number | null }>(
      `SELECT SUM(current_balance) AS total FROM accounts`,
    ),
  ]);

  return {
    monthly,
    roiByBookmaker,
    roiBySource,
    roiBySport,
    betCounts,
    topBestBets,
    topWorstBets,
    totalRoi: calculateRoi(totalExposure?.profit ?? 0, totalExposure?.stake ?? 0),
    currentBlockedMoney: roundMoney(blockedMoney?.total ?? 0),
    matchedExpectedActualDiff: roundMoney(matchedDiff?.total ?? 0),
    pendingExpectedProfitMonth: roundMoney(pendingMonth?.total ?? 0),
    pendingExpectedProfitTotal: roundMoney(pendingTotal?.total ?? 0),
    pendingCompletedCount: pendingCompleted?.total ?? 0,
    pendingCancelledCount: pendingCancelled?.total ?? 0,
    projectedCapitalWithPending: roundMoney(
      (currentCapital?.total ?? 0) + (pendingTotal?.total ?? 0),
    ),
  };
}

async function getRoiStats(sql: string): Promise<RoiStat[]> {
  const rows = await getAll<ProfitStakeRow>(sql);
  return rows.map((row) => ({
    label: row.label ?? 'Sin dato',
    profit: roundMoney(row.profit ?? 0),
    stake: roundMoney(row.stake ?? 0),
    roi: calculateRoi(row.profit ?? 0, row.stake ?? 0),
  }));
}

function ensureMonth(monthMap: Map<string, MonthlyStat>, month: string): MonthlyStat {
  if (!monthMap.has(month)) {
    monthMap.set(month, {
      month,
      ingresos: 0,
      gastos: 0,
      beneficio_neto: 0,
      apuestas_profit_loss: 0,
      matched_profit_loss: 0,
      capital_estimado: 0,
    });
  }

  return monthMap.get(month)!;
}
