import { getAll, getFirst } from '../db/database';

export interface DiagnosticRow {
  label: string;
  value: string;
  status: 'ok' | 'warning' | 'danger';
}

interface CountRow {
  count: number;
}

export async function runDiagnostics(): Promise<DiagnosticRow[]> {
  const tableCounts = await Promise.all(
    [
      'accounts',
      'transactions',
      'transfers',
      'bets',
      'matched_bets',
      'categories',
      'audit_log',
      'backups',
    ].map(async (tableName) => {
      const row = await getFirst<CountRow>(`SELECT COUNT(*) AS count FROM ${tableName}`);
      return {
        label: `Registros ${tableName}`,
        value: String(row?.count ?? 0),
        status: 'ok' as const,
      };
    }),
  );

  const integrity = await getFirst<{ integrity_check: string }>('PRAGMA integrity_check');
  const pageCount = await getFirst<{ page_count: number }>('PRAGMA page_count');
  const pageSize = await getFirst<{ page_size: number }>('PRAGMA page_size');
  const orphanTransactions = await getFirst<CountRow>(
    `SELECT COUNT(*) AS count
     FROM transactions t
     LEFT JOIN accounts a ON a.id = t.account_id
     WHERE a.id IS NULL`,
  );
  const betsWithoutStake = await getFirst<CountRow>(
    `SELECT COUNT(*) AS count
     FROM bets b
     LEFT JOIN transactions t
       ON t.related_bet_id = b.id AND t.type = 'stake_apuesta'
     WHERE t.id IS NULL`,
  );
  const incompleteMatched = await getFirst<CountRow>(
    `SELECT COUNT(*) AS count
     FROM matched_bets
     WHERE bookmaker_account_id IS NULL
        OR exchange_account_id IS NULL
        OR back_odds <= 1
        OR lay_odds <= 1
        OR back_stake <= 0
        OR lay_stake <= 0`,
  );

  const sizeBytes = (pageCount?.page_count ?? 0) * (pageSize?.page_size ?? 0);

  return [
    {
      label: 'Integridad SQLite',
      value: integrity?.integrity_check ?? 'unknown',
      status: integrity?.integrity_check === 'ok' ? 'ok' : 'danger',
    },
    {
      label: 'Tamano estimado BD',
      value: `${Math.round(sizeBytes / 1024)} KB`,
      status: 'ok',
    },
    ...tableCounts,
    {
      label: 'Movimientos huerfanos',
      value: String(orphanTransactions?.count ?? 0),
      status: (orphanTransactions?.count ?? 0) === 0 ? 'ok' : 'danger',
    },
    {
      label: 'Apuestas sin stake asociado',
      value: String(betsWithoutStake?.count ?? 0),
      status: (betsWithoutStake?.count ?? 0) === 0 ? 'ok' : 'warning',
    },
    {
      label: 'Matched bets incompletas',
      value: String(incompleteMatched?.count ?? 0),
      status: (incompleteMatched?.count ?? 0) === 0 ? 'ok' : 'warning',
    },
  ];
}

export async function exportDiagnosticLogText(): Promise<string> {
  const diagnostics = await runDiagnostics();
  const lines = diagnostics.map((item) => `${item.status.toUpperCase()} | ${item.label}: ${item.value}`);
  const recentAudit = await getAll<{ date: string; action: string; table_name: string; record_id: string | null }>(
    `SELECT date, action, table_name, record_id
     FROM audit_log
     ORDER BY date DESC
     LIMIT 100`,
  );

  return [
    'Capital Tracker MB diagnostics',
    new Date().toISOString(),
    '',
    ...lines,
    '',
    'Recent audit log',
    ...recentAudit.map((row) => `${row.date} | ${row.action} | ${row.table_name} | ${row.record_id ?? ''}`),
  ].join('\n');
}
