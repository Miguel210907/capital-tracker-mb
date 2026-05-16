export const SCHEMA_SQL = [
  `PRAGMA foreign_keys = ON`,

  `CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (
      type IN (
        'banco',
        'efectivo',
        'casa_apuestas',
        'exchange',
        'broker',
        'wallet',
        'inversion',
        'crowdlending',
        'otro'
      )
    ),
    initial_balance REAL NOT NULL DEFAULT 0,
    current_balance REAL NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'EUR',
    notes TEXT,
    import_hash TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS bets (
    id TEXT PRIMARY KEY NOT NULL,
    date TEXT NOT NULL,
    event TEXT NOT NULL,
    sport TEXT,
    competition TEXT,
    market TEXT,
    selection TEXT,
    bet_description TEXT NOT NULL,
    odds REAL NOT NULL,
    stake REAL NOT NULL,
    bookmaker_account_id TEXT NOT NULL,
    source TEXT,
    status TEXT NOT NULL CHECK (
      status IN (
        'pendiente',
        'ganada',
        'perdida',
        'nula',
        'cashout',
        'cancelada'
      )
    ),
    result TEXT,
    potential_return REAL NOT NULL DEFAULT 0,
    potential_profit REAL NOT NULL DEFAULT 0,
    profit_loss REAL NOT NULL DEFAULT 0,
    settled_at TEXT,
    notes TEXT,
    import_hash TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (bookmaker_account_id) REFERENCES accounts(id) ON DELETE RESTRICT
  )`,

  `CREATE TABLE IF NOT EXISTS matched_bets (
    id TEXT PRIMARY KEY NOT NULL,
    date TEXT NOT NULL,
    event TEXT NOT NULL,
    sport TEXT,
    bookmaker_account_id TEXT NOT NULL,
    exchange_account_id TEXT NOT NULL,
    source TEXT,
    offer_type TEXT NOT NULL CHECK (
      offer_type IN (
        'qualifying_bet',
        'freebet',
        'refund_offer',
        'risk_free',
        'reload',
        'dutching',
        'hedge',
        'otro'
      )
    ),
    back_selection TEXT,
    back_odds REAL NOT NULL DEFAULT 0,
    back_stake REAL NOT NULL DEFAULT 0,
    lay_odds REAL NOT NULL DEFAULT 0,
    lay_stake REAL NOT NULL DEFAULT 0,
    lay_commission REAL NOT NULL DEFAULT 0,
    lay_liability REAL NOT NULL DEFAULT 0,
    freebet_amount REAL NOT NULL DEFAULT 0,
    expected_profit REAL NOT NULL DEFAULT 0,
    actual_profit REAL NOT NULL DEFAULT 0,
    expected_actual_diff REAL NOT NULL DEFAULT 0,
    roi REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pendiente' CHECK (
      status IN (
        'pendiente',
        'liquidada',
        'cancelada',
        'corregida'
      )
    ),
    result TEXT CHECK (
      result IS NULL OR result IN (
        'gana_back',
        'pierde_back',
        'manual'
      )
    ),
    settled_at TEXT,
    notes TEXT,
    import_hash TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (bookmaker_account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
    FOREIGN KEY (exchange_account_id) REFERENCES accounts(id) ON DELETE RESTRICT
  )`,

  `CREATE TABLE IF NOT EXISTS transfers (
    id TEXT PRIMARY KEY NOT NULL,
    date TEXT NOT NULL,
    from_account_id TEXT NOT NULL,
    to_account_id TEXT NOT NULL,
    amount REAL NOT NULL,
    fee REAL NOT NULL DEFAULT 0,
    notes TEXT,
    import_hash TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (from_account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
    FOREIGN KEY (to_account_id) REFERENCES accounts(id) ON DELETE RESTRICT
  )`,

  `CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY NOT NULL,
    date TEXT NOT NULL,
    account_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (
      type IN (
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
        'deposito'
      )
    ),
    category TEXT,
    amount REAL NOT NULL,
    description TEXT,
    related_bet_id TEXT,
    related_matched_bet_id TEXT,
    transfer_id TEXT,
    notes TEXT,
    import_hash TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
    FOREIGN KEY (related_bet_id) REFERENCES bets(id) ON DELETE SET NULL,
    FOREIGN KEY (related_matched_bet_id) REFERENCES matched_bets(id) ON DELETE SET NULL,
    FOREIGN KEY (transfer_id) REFERENCES transfers(id) ON DELETE SET NULL
  )`,

  `CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (
      type IN (
        'ingreso',
        'gasto',
        'apuesta',
        'matched_betting',
        'transferencia',
        'ajuste'
      )
    ),
    color TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(name, type)
  )`,

  `CREATE TABLE IF NOT EXISTS settings (
    id TEXT PRIMARY KEY NOT NULL,
    key TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY NOT NULL,
    date TEXT NOT NULL,
    action TEXT NOT NULL CHECK (
      action IN (
        'create',
        'update',
        'delete',
        'import',
        'restore',
        'recalculate',
        'diagnostic'
      )
    ),
    table_name TEXT NOT NULL,
    record_id TEXT,
    old_value TEXT,
    new_value TEXT,
    created_at TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS import_batches (
    id TEXT PRIMARY KEY NOT NULL,
    date TEXT NOT NULL,
    source_file TEXT,
    mode TEXT NOT NULL CHECK (mode IN ('add', 'replace')),
    status TEXT NOT NULL CHECK (status IN ('preview', 'completed', 'failed')),
    rows_total INTEGER NOT NULL DEFAULT 0,
    rows_inserted INTEGER NOT NULL DEFAULT 0,
    rows_skipped INTEGER NOT NULL DEFAULT 0,
    errors TEXT,
    created_at TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS backups (
    id TEXT PRIMARY KEY NOT NULL,
    date TEXT NOT NULL,
    file_name TEXT NOT NULL,
    format TEXT NOT NULL CHECK (format IN ('json', 'sqlite')),
    notes TEXT,
    created_at TEXT NOT NULL
  )`,
];

export const INDEX_SQL = [
  `CREATE INDEX IF NOT EXISTS idx_accounts_type ON accounts(type)`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date)`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id)`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type)`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_related_bet_id ON transactions(related_bet_id)`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_related_matched_bet_id ON transactions(related_matched_bet_id)`,
  `CREATE INDEX IF NOT EXISTS idx_transfers_date ON transfers(date)`,
  `CREATE INDEX IF NOT EXISTS idx_bets_date ON bets(date)`,
  `CREATE INDEX IF NOT EXISTS idx_bets_status ON bets(status)`,
  `CREATE INDEX IF NOT EXISTS idx_bets_bookmaker_account_id ON bets(bookmaker_account_id)`,
  `CREATE INDEX IF NOT EXISTS idx_bets_source ON bets(source)`,
  `CREATE INDEX IF NOT EXISTS idx_matched_bets_date ON matched_bets(date)`,
  `CREATE INDEX IF NOT EXISTS idx_matched_bets_status ON matched_bets(status)`,
  `CREATE INDEX IF NOT EXISTS idx_matched_bets_bookmaker_account_id ON matched_bets(bookmaker_account_id)`,
  `CREATE INDEX IF NOT EXISTS idx_matched_bets_exchange_account_id ON matched_bets(exchange_account_id)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_log_date ON audit_log(date)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_log_table_name ON audit_log(table_name)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_import_hash ON accounts(import_hash) WHERE import_hash IS NOT NULL`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_import_hash ON transactions(import_hash) WHERE import_hash IS NOT NULL`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_bets_import_hash ON bets(import_hash) WHERE import_hash IS NOT NULL`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_matched_bets_import_hash ON matched_bets(import_hash) WHERE import_hash IS NOT NULL`,
];
