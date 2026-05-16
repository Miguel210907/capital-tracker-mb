import type { BetStatus, MatchedOfferType, TransactionType } from '../domain/types';
import { roundMoney } from '../utils/money';

export interface BetPotential {
  potentialReturn: number;
  potentialProfit: number;
}

export interface BetSettlementInput {
  status: Exclude<BetStatus, 'pendiente'>;
  stake: number;
  odds: number;
  cashoutAmount?: number;
}

export interface BetSettlementResult {
  profitLoss: number;
  liquidationAmount: number;
}

export interface MatchedExpectedInput {
  offerType: MatchedOfferType;
  backOdds: number;
  backStake: number;
  layOdds: number;
  layStake: number;
  layCommission: number;
  freebetAmount?: number;
}

export interface MatchedExpectedResult {
  layLiability: number;
  profitIfBackWins: number;
  profitIfBackLoses: number;
  expectedProfit: number;
  roi: number;
}

export interface MatchedSettlementInput extends MatchedExpectedInput {
  result: 'gana_back' | 'pierde_back' | 'manual';
  manualBookmakerAmount?: number;
  manualExchangeAmount?: number;
}

export interface MatchedSettlementResult {
  actualProfit: number;
  bookmakerLiquidationAmount: number;
  exchangeLiquidationAmount: number;
  expectedActualDiff: number;
  roi: number;
}

export function normalizeTransactionAmount(type: TransactionType, amount: number): number {
  const absAmount = Math.abs(amount);

  switch (type) {
    case 'ingreso':
    case 'transferencia_entrada':
    case 'bonus':
    case 'deposito':
      return roundMoney(absAmount);
    case 'gasto':
    case 'transferencia_salida':
    case 'stake_apuesta':
    case 'stake_back':
    case 'stake_lay':
    case 'liability_lay':
    case 'comision':
    case 'retirada':
      return roundMoney(-absAmount);
    case 'ajuste':
    case 'liquidacion_apuesta':
    case 'liquidacion_matched_betting':
      return roundMoney(amount);
    default:
      return roundMoney(amount);
  }
}

export function calculateBetPotential(stake: number, odds: number): BetPotential {
  return {
    potentialReturn: roundMoney(stake * odds),
    potentialProfit: roundMoney(stake * odds - stake),
  };
}

export function calculateBetSettlement(input: BetSettlementInput): BetSettlementResult {
  const stake = roundMoney(input.stake);
  const grossReturn = roundMoney(input.stake * input.odds);

  switch (input.status) {
    case 'ganada':
      return {
        profitLoss: roundMoney(grossReturn - stake),
        liquidationAmount: grossReturn,
      };
    case 'perdida':
      return {
        profitLoss: roundMoney(-stake),
        liquidationAmount: 0,
      };
    case 'nula':
    case 'cancelada':
      return {
        profitLoss: 0,
        liquidationAmount: stake,
      };
    case 'cashout': {
      const cashoutAmount = roundMoney(input.cashoutAmount ?? 0);
      return {
        profitLoss: roundMoney(cashoutAmount - stake),
        liquidationAmount: cashoutAmount,
      };
    }
    default:
      throw new Error('Estado de apuesta no soportado para liquidacion.');
  }
}

export function calculateLayLiability(layStake: number, layOdds: number): number {
  return roundMoney(layStake * (layOdds - 1));
}

export function calculateMatchedExpected(input: MatchedExpectedInput): MatchedExpectedResult {
  const freebetAmount = roundMoney(input.freebetAmount ?? 0);
  const isFreebet = input.offerType === 'freebet' || freebetAmount > 0;
  const cashBackStake = isFreebet ? 0 : input.backStake;
  const backStakeForWin = isFreebet ? freebetAmount || input.backStake : input.backStake;
  const layLiability = calculateLayLiability(input.layStake, input.layOdds);
  const commissionRate = input.layCommission / 100;

  const backProfitIfWin = roundMoney(backStakeForWin * (input.backOdds - 1));
  const layLossIfBackWins = roundMoney(-layLiability);
  const profitIfBackWins = roundMoney(backProfitIfWin + layLossIfBackWins);

  const backLossIfBackLoses = roundMoney(-cashBackStake);
  const layProfitIfBackLoses = roundMoney(input.layStake * (1 - commissionRate));
  const profitIfBackLoses = roundMoney(backLossIfBackLoses + layProfitIfBackLoses);

  const expectedProfit = roundMoney(Math.min(profitIfBackWins, profitIfBackLoses));
  const exposure = roundMoney(cashBackStake + layLiability);
  const roi = exposure > 0 ? roundMoney((expectedProfit / exposure) * 100) : 0;

  return {
    layLiability,
    profitIfBackWins,
    profitIfBackLoses,
    expectedProfit,
    roi,
  };
}

export function calculateMatchedSettlement(
  input: MatchedSettlementInput,
): MatchedSettlementResult {
  const expected = calculateMatchedExpected(input);
  const commissionRate = input.layCommission / 100;
  const freebetAmount = roundMoney(input.freebetAmount ?? 0);
  const isFreebet = input.offerType === 'freebet' || freebetAmount > 0;
  const cashBackStake = isFreebet ? 0 : input.backStake;
  const bookmakerStakeReturn = isFreebet ? 0 : input.backStake;
  const backStakeForWin = isFreebet ? freebetAmount || input.backStake : input.backStake;

  if (input.result === 'manual') {
    const bookmakerLiquidationAmount = roundMoney(input.manualBookmakerAmount ?? 0);
    const exchangeLiquidationAmount = roundMoney(input.manualExchangeAmount ?? 0);
    const actualProfit = roundMoney(
      bookmakerLiquidationAmount + exchangeLiquidationAmount - cashBackStake - expected.layLiability,
    );

    return {
      actualProfit,
      bookmakerLiquidationAmount,
      exchangeLiquidationAmount,
      expectedActualDiff: roundMoney(actualProfit - expected.expectedProfit),
      roi: calculateRoi(actualProfit, cashBackStake + expected.layLiability),
    };
  }

  if (input.result === 'gana_back') {
    const bookmakerLiquidationAmount = roundMoney(backStakeForWin * input.backOdds + bookmakerStakeReturn - backStakeForWin);
    const exchangeLiquidationAmount = 0;
    const actualProfit = roundMoney(
      bookmakerLiquidationAmount - cashBackStake - expected.layLiability,
    );

    return {
      actualProfit,
      bookmakerLiquidationAmount,
      exchangeLiquidationAmount,
      expectedActualDiff: roundMoney(actualProfit - expected.expectedProfit),
      roi: calculateRoi(actualProfit, cashBackStake + expected.layLiability),
    };
  }

  const exchangeWinAmount = roundMoney(input.layStake * (1 - commissionRate));
  const exchangeLiquidationAmount = roundMoney(expected.layLiability + exchangeWinAmount);
  const bookmakerLiquidationAmount = 0;
  const actualProfit = roundMoney(exchangeWinAmount - cashBackStake);

  return {
    actualProfit,
    bookmakerLiquidationAmount,
    exchangeLiquidationAmount,
    expectedActualDiff: roundMoney(actualProfit - expected.expectedProfit),
    roi: calculateRoi(actualProfit, cashBackStake + expected.layLiability),
  };
}

export function calculateRoi(profit: number, exposure: number): number {
  return exposure > 0 ? roundMoney((profit / exposure) * 100) : 0;
}
