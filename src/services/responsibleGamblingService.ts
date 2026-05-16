import { RESPONSIBLE_GAMBLING_SETTING_KEYS } from '../domain/constants';
import { getAll } from '../db/database';
import {
  getNumberSetting,
  setNumberSetting,
} from '../db/repositories/settingsRepository';
import { roundMoney } from '../utils/money';

export interface ResponsibleGamblingLimits {
  dailyStakeLimit: number;
  weeklyStakeLimit: number;
  monthlyStakeLimit: number;
  monthlyLossLimit: number;
  bookmakerStakeLimit: number;
}

export interface ResponsibleGamblingWarning {
  code: string;
  message: string;
}

interface StakeRow {
  total: number | null;
}

const LIMIT_KEYS = RESPONSIBLE_GAMBLING_SETTING_KEYS;

export async function getResponsibleGamblingLimits(
  bookmakerAccountId?: string,
): Promise<ResponsibleGamblingLimits> {
  const bookmakerKey = bookmakerAccountId
    ? `${LIMIT_KEYS.bookmakerStakeLimitPrefix}${bookmakerAccountId}`
    : '';

  return {
    dailyStakeLimit: await getNumberSetting(LIMIT_KEYS.dailyStakeLimit, 0),
    weeklyStakeLimit: await getNumberSetting(LIMIT_KEYS.weeklyStakeLimit, 0),
    monthlyStakeLimit: await getNumberSetting(LIMIT_KEYS.monthlyStakeLimit, 0),
    monthlyLossLimit: await getNumberSetting(LIMIT_KEYS.monthlyLossLimit, 0),
    bookmakerStakeLimit: bookmakerKey ? await getNumberSetting(bookmakerKey, 0) : 0,
  };
}

export async function saveResponsibleGamblingLimits(
  limits: ResponsibleGamblingLimits,
  bookmakerAccountId?: string,
): Promise<void> {
  await setNumberSetting(LIMIT_KEYS.dailyStakeLimit, limits.dailyStakeLimit);
  await setNumberSetting(LIMIT_KEYS.weeklyStakeLimit, limits.weeklyStakeLimit);
  await setNumberSetting(LIMIT_KEYS.monthlyStakeLimit, limits.monthlyStakeLimit);
  await setNumberSetting(LIMIT_KEYS.monthlyLossLimit, limits.monthlyLossLimit);

  if (bookmakerAccountId) {
    await setNumberSetting(
      `${LIMIT_KEYS.bookmakerStakeLimitPrefix}${bookmakerAccountId}`,
      limits.bookmakerStakeLimit,
    );
  }
}

export async function checkStakeLimits(input: {
  date: string;
  stake: number;
  bookmakerAccountId?: string;
}): Promise<ResponsibleGamblingWarning[]> {
  const limits = await getResponsibleGamblingLimits(input.bookmakerAccountId);
  const warnings: ResponsibleGamblingWarning[] = [];
  const day = input.date;
  const week = getWeekRange(input.date);
  const month = `${input.date.slice(0, 7)}%`;

  const dailyStake = await sumStakeWhere(`date = ?`, [day]);
  const weeklyStake = await sumStakeWhere(`date BETWEEN ? AND ?`, [week.start, week.end]);
  const monthlyStake = await sumStakeWhere(`date LIKE ?`, [month]);
  const monthlyLoss = await sumMonthlyLoss(month);

  if (limits.dailyStakeLimit > 0 && dailyStake + input.stake > limits.dailyStakeLimit) {
    warnings.push({
      code: 'daily_stake_limit',
      message: `Superas el limite diario apostado (${limits.dailyStakeLimit} EUR).`,
    });
  }

  if (limits.weeklyStakeLimit > 0 && weeklyStake + input.stake > limits.weeklyStakeLimit) {
    warnings.push({
      code: 'weekly_stake_limit',
      message: `Superas el limite semanal apostado (${limits.weeklyStakeLimit} EUR).`,
    });
  }

  if (limits.monthlyStakeLimit > 0 && monthlyStake + input.stake > limits.monthlyStakeLimit) {
    warnings.push({
      code: 'monthly_stake_limit',
      message: `Superas el limite mensual apostado (${limits.monthlyStakeLimit} EUR).`,
    });
  }

  if (limits.monthlyLossLimit > 0 && monthlyLoss > limits.monthlyLossLimit) {
    warnings.push({
      code: 'monthly_loss_limit',
      message: `Ya superas el limite mensual de perdidas (${limits.monthlyLossLimit} EUR).`,
    });
  }

  if (input.bookmakerAccountId && limits.bookmakerStakeLimit > 0) {
    const bookmakerStake = await sumStakeWhere(`bookmaker_account_id = ? AND date LIKE ?`, [
      input.bookmakerAccountId,
      month,
    ]);
    if (bookmakerStake + input.stake > limits.bookmakerStakeLimit) {
      warnings.push({
        code: 'bookmaker_stake_limit',
        message: `Superas el limite mensual de esta casa (${limits.bookmakerStakeLimit} EUR).`,
      });
    }
  }

  return warnings;
}

async function sumStakeWhere(where: string, params: unknown[]): Promise<number> {
  const bets = await getAll<StakeRow>(
    `SELECT SUM(stake) AS total FROM bets WHERE ${where}`,
    params,
  );
  const matched = await getAll<StakeRow>(
    `SELECT SUM(back_stake) AS total FROM matched_bets WHERE ${where}`,
    params,
  );

  return roundMoney((bets[0]?.total ?? 0) + (matched[0]?.total ?? 0));
}

async function sumMonthlyLoss(monthLike: string): Promise<number> {
  const bets = await getAll<StakeRow>(
    `SELECT SUM(profit_loss) AS total
     FROM bets
     WHERE date LIKE ? AND profit_loss < 0`,
    [monthLike],
  );
  const matched = await getAll<StakeRow>(
    `SELECT SUM(actual_profit) AS total
     FROM matched_bets
     WHERE date LIKE ? AND actual_profit < 0`,
    [monthLike],
  );

  return Math.abs(roundMoney((bets[0]?.total ?? 0) + (matched[0]?.total ?? 0)));
}

function getWeekRange(dbDate: string): { start: string; end: string } {
  const date = new Date(`${dbDate}T00:00:00.000Z`);
  const day = date.getUTCDay() || 7;
  const start = new Date(date);
  start.setUTCDate(date.getUTCDate() - day + 1);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);

  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}
