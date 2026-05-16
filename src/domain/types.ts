export type AccountType =
  | 'banco'
  | 'efectivo'
  | 'casa_apuestas'
  | 'exchange'
  | 'broker'
  | 'wallet'
  | 'inversion'
  | 'crowdlending'
  | 'otro';

export type TransactionType =
  | 'ingreso'
  | 'gasto'
  | 'transferencia_entrada'
  | 'transferencia_salida'
  | 'ajuste'
  | 'stake_apuesta'
  | 'liquidacion_apuesta'
  | 'stake_back'
  | 'stake_lay'
  | 'liability_lay'
  | 'liquidacion_matched_betting'
  | 'bonus'
  | 'comision'
  | 'retirada'
  | 'deposito';

export type CategoryType =
  | 'ingreso'
  | 'gasto'
  | 'apuesta'
  | 'matched_betting'
  | 'transferencia'
  | 'ajuste';

export type BetStatus =
  | 'pendiente'
  | 'ganada'
  | 'perdida'
  | 'nula'
  | 'cashout'
  | 'cancelada';

export type MatchedBetStatus = 'pendiente' | 'liquidada' | 'cancelada' | 'corregida';

export type MatchedBetResult = 'gana_back' | 'pierde_back' | 'manual';

export type MatchedOfferType =
  | 'qualifying_bet'
  | 'freebet'
  | 'refund_offer'
  | 'risk_free'
  | 'reload'
  | 'dutching'
  | 'hedge'
  | 'otro';

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'import'
  | 'restore'
  | 'recalculate'
  | 'diagnostic';

export interface BaseRecord {
  id: string;
  created_at: string;
  updated_at: string;
}

export interface Account extends BaseRecord {
  name: string;
  type: AccountType;
  initial_balance: number;
  current_balance: number;
  currency: string;
  notes?: string | null;
  import_hash?: string | null;
}

export interface Transaction extends BaseRecord {
  date: string;
  account_id: string;
  type: TransactionType;
  category?: string | null;
  amount: number;
  description?: string | null;
  related_bet_id?: string | null;
  related_matched_bet_id?: string | null;
  transfer_id?: string | null;
  notes?: string | null;
  import_hash?: string | null;
}

export interface Transfer {
  id: string;
  date: string;
  from_account_id: string;
  to_account_id: string;
  amount: number;
  fee: number;
  notes?: string | null;
  import_hash?: string | null;
  created_at: string;
}

export interface Bet extends BaseRecord {
  date: string;
  event: string;
  sport?: string | null;
  competition?: string | null;
  market?: string | null;
  selection?: string | null;
  bet_description: string;
  odds: number;
  stake: number;
  bookmaker_account_id: string;
  source?: string | null;
  status: BetStatus;
  result?: string | null;
  potential_return: number;
  potential_profit: number;
  profit_loss: number;
  settled_at?: string | null;
  notes?: string | null;
  import_hash?: string | null;
}

export interface MatchedBet extends BaseRecord {
  date: string;
  event: string;
  sport?: string | null;
  bookmaker_account_id: string;
  exchange_account_id: string;
  source?: string | null;
  offer_type: MatchedOfferType;
  back_selection?: string | null;
  back_odds: number;
  back_stake: number;
  lay_odds: number;
  lay_stake: number;
  lay_commission: number;
  lay_liability: number;
  freebet_amount: number;
  expected_profit: number;
  actual_profit: number;
  expected_actual_diff: number;
  roi: number;
  status: MatchedBetStatus;
  result?: MatchedBetResult | null;
  settled_at?: string | null;
  notes?: string | null;
  import_hash?: string | null;
}

export interface Category extends BaseRecord {
  name: string;
  type: CategoryType;
  color?: string | null;
}

export interface Setting extends BaseRecord {
  key: string;
  value: string;
}

export interface AuditLog {
  id: string;
  date: string;
  action: AuditAction;
  table_name: string;
  record_id?: string | null;
  old_value?: string | null;
  new_value?: string | null;
  created_at: string;
}

export interface DashboardSummary {
  capital_total: number;
  capital_disponible: number;
  dinero_bloqueado_apuestas: number;
  dinero_bloqueado_matched_betting: number;
  saldo_real_estimado: number;
  ingresos_mes: number;
  gastos_mes: number;
  apuestas_profit_loss_mes: number;
  matched_profit_loss_mes: number;
  apuestas_pendientes: number;
  roi_apuestas: number;
  roi_matched_betting: number;
}

export interface DateRangeFilter {
  from?: string;
  to?: string;
}

export interface ListFilter extends DateRangeFilter {
  accountId?: string;
  type?: string;
  category?: string;
  bookmakerAccountId?: string;
  source?: string;
  status?: string;
  text?: string;
  profitSign?: 'positive' | 'negative';
}
