import type {
  AccountType,
  BetStatus,
  MatchedOfferType,
  PendingItemStatus,
  PendingItemType,
  TransactionType,
} from './types';

export const DEFAULT_CURRENCY = 'EUR';

export const ACCOUNT_TYPES: AccountType[] = [
  'banco',
  'efectivo',
  'casa_apuestas',
  'exchange',
  'broker',
  'wallet',
  'inversion',
  'crowdlending',
  'otro',
];

export const TRANSACTION_TYPES: TransactionType[] = [
  'ingreso',
  'gasto',
  'transferencia_entrada',
  'transferencia_salida',
  'ajuste',
  'stake_apuesta',
  'liquidacion_apuesta',
  'stake_back',
  'stake_lay',
  'liability_lay',
  'liquidacion_matched_betting',
  'bonus',
  'comision',
  'retirada',
  'deposito',
];

export const BET_STATUSES: BetStatus[] = [
  'pendiente',
  'ganada',
  'perdida',
  'nula',
  'cashout',
  'cancelada',
];

export const MATCHED_OFFER_TYPES: MatchedOfferType[] = [
  'qualifying_bet',
  'freebet',
  'refund_offer',
  'risk_free',
  'reload',
  'dutching',
  'hedge',
  'otro',
];

export const PENDING_ITEM_TYPES: PendingItemType[] = [
  'venta',
  'matched_betting',
  'ingreso_previsto',
  'gasto_previsto',
  'suscripcion',
  'devolucion',
  'bonus',
  'inversion',
  'otro',
];

export const PENDING_ITEM_STATUSES: PendingItemStatus[] = [
  'pendiente',
  'en_curso',
  'completado',
  'cancelado',
  'vencido',
];

export const RESPONSIBLE_GAMBLING_SETTING_KEYS = {
  dailyStakeLimit: 'responsible.daily_stake_limit',
  weeklyStakeLimit: 'responsible.weekly_stake_limit',
  monthlyStakeLimit: 'responsible.monthly_stake_limit',
  monthlyLossLimit: 'responsible.monthly_loss_limit',
  bookmakerStakeLimitPrefix: 'responsible.bookmaker_stake_limit.',
} as const;
