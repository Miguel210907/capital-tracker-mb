import type { SQLiteDatabase } from 'expo-sqlite';

import { getAll, getFirst, withTransaction } from '../db/database';
import { createAuditLog } from '../db/repositories/auditLogRepository';
import { DEFAULT_CURRENCY } from '../domain/constants';
import { parseCsv, serializeCsv, normalizeCsvNumber, normalizeCsvText } from '../utils/csv';
import { nowIso, todayDbDate } from '../utils/dates';
import { stableHash } from '../utils/hashes';
import { createId } from '../utils/ids';
import { roundMoney } from '../utils/money';
import { calculateBetPotential, calculateMatchedExpected } from './calculations';
import { createAutomaticBackupBeforeImport } from './backupService';
import {
  readBase64File,
  readTextFile,
  saveBase64File,
  saveTextFile,
  shareFile,
  timestampForFileName,
} from './fileService';
import { recalculateBalances } from './transactionService';

export type CsvTableName =
  | 'accounts'
  | 'transactions'
  | 'transfers'
  | 'bets'
  | 'matched_bets'
  | 'pending_items'
  | 'categories'
  | 'resumen_mensual';

export type CsvImportMode = 'add' | 'replace';

interface CsvTableConfig {
  tableName: Exclude<CsvTableName, 'resumen_mensual'>;
  label: string;
  prefix: string;
  columns: string[];
  requiredColumns: string[];
  numericColumns: string[];
  nullableColumns: string[];
  hasImportHash: boolean;
}

export interface CsvExportOption {
  tableName: CsvTableName;
  label: string;
}

export interface CsvImportPreview {
  fileName: string;
  tableName: Exclude<CsvTableName, 'resumen_mensual'> | null;
  tableLabel: string | null;
  headers: string[];
  rows: Record<string, string>[];
  sampleRows: Record<string, string>[];
  totalRows: number;
  duplicateRows: number;
  missingColumns: string[];
  errors: string[];
}

export interface CsvImportResult {
  tableName: string;
  mode: CsvImportMode;
  rowsTotal: number;
  rowsInserted: number;
  rowsSkipped: number;
  backupFileName: string;
}

export interface CsvExportResult {
  uri: string;
  fileName: string;
  shared: boolean;
}

export interface XlsxImportPreview {
  fileName: string;
  sheets: CsvImportPreview[];
  errors: string[];
}

const CSV_TABLE_CONFIGS: CsvTableConfig[] = [
  {
    tableName: 'accounts',
    label: 'Cuentas',
    prefix: 'acc',
    columns: [
      'id',
      'name',
      'type',
      'initial_balance',
      'current_balance',
      'currency',
      'notes',
      'import_hash',
      'created_at',
      'updated_at',
    ],
    requiredColumns: ['name', 'type'],
    numericColumns: ['initial_balance', 'current_balance'],
    nullableColumns: ['notes', 'import_hash'],
    hasImportHash: true,
  },
  {
    tableName: 'transactions',
    label: 'Movimientos',
    prefix: 'mov',
    columns: [
      'id',
      'date',
      'account_id',
      'type',
      'category',
      'amount',
      'description',
      'related_bet_id',
      'related_matched_bet_id',
      'transfer_id',
      'notes',
      'import_hash',
      'created_at',
      'updated_at',
    ],
    requiredColumns: ['date', 'account_id', 'type', 'amount'],
    numericColumns: ['amount'],
    nullableColumns: [
      'category',
      'description',
      'related_bet_id',
      'related_matched_bet_id',
      'transfer_id',
      'notes',
      'import_hash',
    ],
    hasImportHash: true,
  },
  {
    tableName: 'transfers',
    label: 'Transferencias',
    prefix: 'trf',
    columns: [
      'id',
      'date',
      'from_account_id',
      'to_account_id',
      'amount',
      'fee',
      'notes',
      'import_hash',
      'created_at',
    ],
    requiredColumns: ['date', 'from_account_id', 'to_account_id', 'amount'],
    numericColumns: ['amount', 'fee'],
    nullableColumns: ['notes', 'import_hash'],
    hasImportHash: true,
  },
  {
    tableName: 'bets',
    label: 'Apuestas',
    prefix: 'bet',
    columns: [
      'id',
      'date',
      'event',
      'sport',
      'competition',
      'market',
      'selection',
      'bet_description',
      'odds',
      'stake',
      'bookmaker_account_id',
      'source',
      'status',
      'result',
      'potential_return',
      'potential_profit',
      'profit_loss',
      'settled_at',
      'notes',
      'import_hash',
      'created_at',
      'updated_at',
    ],
    requiredColumns: ['date', 'event', 'bet_description', 'odds', 'stake', 'bookmaker_account_id'],
    numericColumns: ['odds', 'stake', 'potential_return', 'potential_profit', 'profit_loss'],
    nullableColumns: [
      'sport',
      'competition',
      'market',
      'selection',
      'source',
      'result',
      'settled_at',
      'notes',
      'import_hash',
    ],
    hasImportHash: true,
  },
  {
    tableName: 'matched_bets',
    label: 'MatchedBetting',
    prefix: 'mb',
    columns: [
      'id',
      'date',
      'event',
      'sport',
      'bookmaker_account_id',
      'exchange_account_id',
      'source',
      'offer_type',
      'back_selection',
      'back_odds',
      'back_stake',
      'lay_odds',
      'lay_stake',
      'lay_commission',
      'lay_liability',
      'freebet_amount',
      'expected_profit',
      'actual_profit',
      'expected_actual_diff',
      'roi',
      'status',
      'result',
      'settled_at',
      'notes',
      'import_hash',
      'created_at',
      'updated_at',
    ],
    requiredColumns: [
      'date',
      'event',
      'bookmaker_account_id',
      'exchange_account_id',
      'offer_type',
      'back_odds',
      'back_stake',
      'lay_odds',
      'lay_stake',
    ],
    numericColumns: [
      'back_odds',
      'back_stake',
      'lay_odds',
      'lay_stake',
      'lay_commission',
      'lay_liability',
      'freebet_amount',
      'expected_profit',
      'actual_profit',
      'expected_actual_diff',
      'roi',
    ],
    nullableColumns: ['sport', 'source', 'back_selection', 'result', 'settled_at', 'notes', 'import_hash'],
    hasImportHash: true,
  },
  {
    tableName: 'pending_items',
    label: 'Pendientes',
    prefix: 'pen',
    columns: [
      'id',
      'title',
      'type',
      'status',
      'created_date',
      'expected_date',
      'account_id',
      'related_bet_id',
      'related_matched_bet_id',
      'related_transaction_id',
      'investment_required',
      'expected_income',
      'expected_expense',
      'expected_profit',
      'actual_profit',
      'priority',
      'recurrence',
      'notes',
      'import_hash',
      'created_at',
      'updated_at',
    ],
    requiredColumns: ['title', 'type'],
    numericColumns: [
      'investment_required',
      'expected_income',
      'expected_expense',
      'expected_profit',
      'actual_profit',
      'priority',
    ],
    nullableColumns: [
      'expected_date',
      'account_id',
      'related_bet_id',
      'related_matched_bet_id',
      'related_transaction_id',
      'recurrence',
      'notes',
      'import_hash',
    ],
    hasImportHash: true,
  },
  {
    tableName: 'categories',
    label: 'Categorias',
    prefix: 'cat',
    columns: ['id', 'name', 'type', 'color', 'created_at', 'updated_at'],
    requiredColumns: ['name', 'type'],
    numericColumns: [],
    nullableColumns: ['color'],
    hasImportHash: false,
  },
];

export const CSV_EXPORT_OPTIONS: CsvExportOption[] = [
  ...CSV_TABLE_CONFIGS.map((config) => ({
    tableName: config.tableName,
    label: config.label,
  })),
  { tableName: 'resumen_mensual', label: 'Resumen mensual' },
];

export async function exportCsv(tableName: CsvTableName): Promise<CsvExportResult> {
  const rows =
    tableName === 'resumen_mensual'
      ? await getMonthlySummaryRows()
      : await getTableRows(tableName);
  const headers =
    tableName === 'resumen_mensual'
      ? ['month', 'ingresos', 'gastos', 'neto_movimientos', 'apuestas_profit_loss', 'matched_profit_loss']
      : getConfig(tableName).columns;
  const csv = serializeCsv(rows, headers);
  const fileName = `capital-tracker-mb-${tableName}-${timestampForFileName()}.csv`;
  const saved = await saveTextFile(fileName, csv, 'export');
  const shared = await shareFile(saved.uri);

  return {
    uri: saved.uri,
    fileName: saved.fileName,
    shared,
  };
}

export async function exportXlsxWorkbook(): Promise<CsvExportResult> {
  const XLSX = await import('xlsx');
  const workbook = XLSX.utils.book_new();

  for (const option of CSV_EXPORT_OPTIONS) {
    const rows =
      option.tableName === 'resumen_mensual'
        ? await getMonthlySummaryRows()
        : await getTableRows(option.tableName);
    const headers =
      option.tableName === 'resumen_mensual'
        ? ['month', 'ingresos', 'gastos', 'neto_movimientos', 'apuestas_profit_loss', 'matched_profit_loss']
        : getConfig(option.tableName).columns;
    const worksheet = XLSX.utils.json_to_sheet(rows, { header: headers });
    XLSX.utils.book_append_sheet(workbook, worksheet, toSheetName(option.label));
  }

  const statisticsRows = await getStatisticsSheetRows();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(statisticsRows),
    'Estadisticas',
  );

  const base64 = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' });
  const fileName = `capital-tracker-mb-${timestampForFileName()}.xlsx`;
  const saved = await saveBase64File(fileName, base64, 'export');
  const shared = await shareFile(saved.uri);

  return {
    uri: saved.uri,
    fileName: saved.fileName,
    shared,
  };
}

export async function previewCsvImportFromUri(
  uri: string,
  fileName: string,
): Promise<CsvImportPreview> {
  const content = await readTextFile(uri);
  return previewCsvImport(content, fileName);
}

export async function previewXlsxImportFromUri(
  uri: string,
  fileName: string,
): Promise<XlsxImportPreview> {
  const XLSX = await import('xlsx');
  const base64 = await readBase64File(uri);
  const workbook = XLSX.read(base64, { type: 'base64' });
  const sheets: CsvImportPreview[] = [];
  const errors: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
      defval: '',
    });

    if (rows.length === 0) {
      continue;
    }

    const headers = Object.keys(rows[0]);
    const config = detectTableConfig(headers);
    if (!config) {
      continue;
    }

    const normalizedRows = rows.map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([key, value]) => [key, value === null || value === undefined ? '' : String(value)]),
      ),
    );

    const csvPreview = await previewCsvImport(
      serializeCsv(normalizedRows, headers),
      `${fileName}:${sheetName}`,
    );
    sheets.push(csvPreview);
  }

  if (sheets.length === 0) {
    errors.push('No se detectaron hojas importables en el XLSX.');
  }

  return { fileName, sheets, errors };
}

export async function previewCsvImport(
  content: string,
  fileName: string,
): Promise<CsvImportPreview> {
  const parsed = parseCsv(content);
  const config = detectTableConfig(parsed.headers);
  const errors: string[] = [];

  if (parsed.headers.length === 0) {
    errors.push('El CSV no contiene cabeceras.');
  }

  if (!config) {
    errors.push('No se pudo detectar la tabla por las columnas del CSV.');
  }

  const missingColumns = config
    ? config.requiredColumns.filter((column) => !parsed.headers.includes(column))
    : [];

  if (missingColumns.length > 0) {
    errors.push(`Faltan columnas obligatorias: ${missingColumns.join(', ')}.`);
  }

  const rowErrors = config ? validateRows(config, parsed.rows) : [];
  errors.push(...rowErrors.slice(0, 10));

  const duplicateRows = config ? await countDuplicateRows(config, parsed.rows) : 0;

  return {
    fileName,
    tableName: config?.tableName ?? null,
    tableLabel: config?.label ?? null,
    headers: parsed.headers,
    rows: parsed.rows,
    sampleRows: parsed.rows.slice(0, 5),
    totalRows: parsed.rows.length,
    duplicateRows,
    missingColumns,
    errors,
  };
}

export async function importCsvPreview(
  preview: CsvImportPreview,
  mode: CsvImportMode,
): Promise<CsvImportResult> {
  if (!preview.tableName) {
    throw new Error('No hay tabla detectada para importar.');
  }

  if (preview.errors.length > 0) {
    throw new Error(preview.errors[0]);
  }

  const config = getConfig(preview.tableName);
  const automaticBackup = await createAutomaticBackupBeforeImport();

  const result = await withTransaction(async (db) => {
    if (mode === 'replace') {
      await clearTableForReplace(db, config.tableName);
    }

    let rowsInserted = 0;
    let rowsSkipped = 0;

    for (const rawRow of preview.rows) {
      const row = buildImportRow(config, rawRow);
      const duplicate = mode === 'add' ? await isDuplicateRow(db, config, row) : false;

      if (duplicate) {
        rowsSkipped += 1;
        continue;
      }

      const inserted = await insertCsvRow(db, config.tableName, row, mode === 'add');
      if (inserted) {
        rowsInserted += 1;
      } else {
        rowsSkipped += 1;
      }
    }

    const timestamp = nowIso();
    const batchId = createId('imp');
    await db.runAsync(
      `INSERT INTO import_batches
        (id, date, source_file, mode, status, rows_total, rows_inserted, rows_skipped, errors, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        batchId,
        timestamp,
        preview.fileName,
        mode,
        'completed',
        preview.totalRows,
        rowsInserted,
        rowsSkipped,
        null,
        timestamp,
      ],
    );

    await createAuditLog(db, {
      action: 'import',
      tableName: config.tableName,
      recordId: batchId,
      newValue: {
        source_file: preview.fileName,
        mode,
        rows_total: preview.totalRows,
        rows_inserted: rowsInserted,
        rows_skipped: rowsSkipped,
        automatic_backup: automaticBackup.fileName,
      },
    });

    return {
      tableName: config.tableName,
      mode,
      rowsTotal: preview.totalRows,
      rowsInserted,
      rowsSkipped,
      backupFileName: automaticBackup.fileName,
    };
  });

  await recalculateBalances();
  return result;
}

export async function importXlsxPreview(
  preview: XlsxImportPreview,
  mode: CsvImportMode,
): Promise<CsvImportResult[]> {
  if (preview.errors.length > 0) {
    throw new Error(preview.errors[0]);
  }

  const orderedSheets = [...preview.sheets].sort((a, b) => {
    const order = [
      'accounts',
      'categories',
      'bets',
      'matched_bets',
      'transfers',
      'transactions',
      'pending_items',
    ];
    return order.indexOf(a.tableName ?? '') - order.indexOf(b.tableName ?? '');
  });

  const results: CsvImportResult[] = [];
  for (const sheet of orderedSheets) {
    results.push(await importCsvPreview(sheet, mode));
  }

  return results;
}

async function getTableRows(tableName: Exclude<CsvTableName, 'resumen_mensual'>) {
  const config = getConfig(tableName);
  return getAll<Record<string, unknown>>(
    `SELECT ${config.columns.join(', ')} FROM ${config.tableName} ORDER BY created_at ASC`,
  );
}

async function getMonthlySummaryRows(): Promise<Array<Record<string, unknown>>> {
  const transactions = await getAll<{ date: string; type: string; amount: number }>(
    `SELECT date, type, amount FROM transactions`,
  );
  const bets = await getAll<{ date: string; profit_loss: number }>(
    `SELECT date, profit_loss FROM bets WHERE status <> 'pendiente'`,
  );
  const matchedBets = await getAll<{ date: string; actual_profit: number }>(
    `SELECT date, actual_profit FROM matched_bets WHERE status = 'liquidada'`,
  );

  const byMonth = new Map<string, Record<string, number | string>>();

  function ensureMonth(date: string) {
    const month = date.slice(0, 7);
    if (!byMonth.has(month)) {
      byMonth.set(month, {
        month,
        ingresos: 0,
        gastos: 0,
        neto_movimientos: 0,
        apuestas_profit_loss: 0,
        matched_profit_loss: 0,
      });
    }
    return byMonth.get(month)!;
  }

  for (const transaction of transactions) {
    const row = ensureMonth(transaction.date);
    if (transaction.type === 'ingreso') {
      row.ingresos = roundMoney(Number(row.ingresos) + transaction.amount);
    }
    if (transaction.type === 'gasto') {
      row.gastos = roundMoney(Number(row.gastos) + Math.abs(transaction.amount));
    }
    row.neto_movimientos = roundMoney(Number(row.neto_movimientos) + transaction.amount);
  }

  for (const bet of bets) {
    const row = ensureMonth(bet.date);
    row.apuestas_profit_loss = roundMoney(Number(row.apuestas_profit_loss) + bet.profit_loss);
  }

  for (const matchedBet of matchedBets) {
    const row = ensureMonth(matchedBet.date);
    row.matched_profit_loss = roundMoney(
      Number(row.matched_profit_loss) + matchedBet.actual_profit,
    );
  }

  return [...byMonth.values()].sort((a, b) => String(a.month).localeCompare(String(b.month)));
}

function detectTableConfig(headers: string[]): CsvTableConfig | null {
  let best: { config: CsvTableConfig; score: number } | null = null;

  for (const config of CSV_TABLE_CONFIGS) {
    const requiredScore = config.requiredColumns.every((column) => headers.includes(column)) ? 100 : 0;
    const knownScore = headers.filter((header) => config.columns.includes(header)).length;
    const score = requiredScore + knownScore;

    if (!best || score > best.score) {
      best = { config, score };
    }
  }

  return best && best.score >= 100 ? best.config : null;
}

function validateRows(config: CsvTableConfig, rows: Record<string, string>[]): string[] {
  const errors: string[] = [];

  rows.forEach((row, index) => {
    for (const column of config.requiredColumns) {
      if (!row[column]?.trim()) {
        errors.push(`Fila ${index + 2}: falta ${column}.`);
      }
    }
  });

  return errors;
}

async function countDuplicateRows(
  config: CsvTableConfig,
  rows: Record<string, string>[],
): Promise<number> {
  let duplicates = 0;

  for (const rawRow of rows) {
    const row = buildImportRow(config, rawRow);
    const duplicate = await isDuplicateRow(null, config, row);
    if (duplicate) {
      duplicates += 1;
    }
  }

  return duplicates;
}

async function isDuplicateRow(
  db: SQLiteDatabase | null,
  config: CsvTableConfig,
  row: Record<string, unknown>,
): Promise<boolean> {
  const queryDb = db
    ? {
        getFirst: <T>(sql: string, params: unknown[]) => db.getFirstAsync<T>(sql, params as any),
      }
    : {
        getFirst,
      };

  if (row.id) {
    const existing = await queryDb.getFirst<{ count: number }>(
      `SELECT COUNT(*) AS count FROM ${config.tableName} WHERE id = ?`,
      [row.id],
    );

    if ((existing?.count ?? 0) > 0) {
      return true;
    }
  }

  if (config.hasImportHash && row.import_hash) {
    const existing = await queryDb.getFirst<{ count: number }>(
      `SELECT COUNT(*) AS count FROM ${config.tableName} WHERE import_hash = ?`,
      [row.import_hash],
    );

    return (existing?.count ?? 0) > 0;
  }

  return false;
}

function buildImportRow(
  config: CsvTableConfig,
  rawRow: Record<string, string>,
): Record<string, unknown> {
  const timestamp = nowIso();
  const row: Record<string, unknown> = {};

  for (const column of config.columns) {
    const rawValue = rawRow[column];

    if (column === 'id') {
      row[column] = normalizeCsvText(rawValue) ?? createId(config.prefix);
      continue;
    }

    if (column === 'created_at' || column === 'updated_at') {
      row[column] = normalizeCsvText(rawValue) ?? timestamp;
      continue;
    }

    if (column === 'date') {
      row[column] = normalizeCsvText(rawValue) ?? todayDbDate();
      continue;
    }

    if (column === 'currency') {
      row[column] = normalizeCsvText(rawValue) ?? DEFAULT_CURRENCY;
      continue;
    }

    if (column === 'status') {
      row[column] = normalizeCsvText(rawValue) ?? 'pendiente';
      continue;
    }

    if (column === 'offer_type') {
      row[column] = normalizeCsvText(rawValue) ?? 'otro';
      continue;
    }

    if (column === 'import_hash' && config.hasImportHash) {
      row[column] =
        normalizeCsvText(rawValue) ??
        stableHash({ table: config.tableName, row: rawRow as Record<string, string> } as any);
      continue;
    }

    if (config.numericColumns.includes(column)) {
      row[column] = normalizeCsvNumber(rawValue);
      continue;
    }

    row[column] = config.nullableColumns.includes(column)
      ? normalizeCsvText(rawValue)
      : rawValue?.trim() ?? '';
  }

  applyComputedDefaults(config, row, rawRow);
  return row;
}

function applyComputedDefaults(
  config: CsvTableConfig,
  row: Record<string, unknown>,
  rawRow: Record<string, string>,
): void {
  if (config.tableName === 'accounts') {
    row.initial_balance = roundMoney(Number(row.initial_balance ?? 0));
    row.current_balance =
      !rawRow.current_balance?.trim()
        ? row.initial_balance
        : roundMoney(Number(row.current_balance ?? 0));
  }

  if (config.tableName === 'transfers') {
    row.fee = roundMoney(Number(row.fee ?? 0));
  }

  if (config.tableName === 'bets') {
    const odds = Number(row.odds ?? 0);
    const stake = Number(row.stake ?? 0);
    const potential = calculateBetPotential(stake, odds);
    row.potential_return =
      Number(row.potential_return ?? 0) === 0 ? potential.potentialReturn : row.potential_return;
    row.potential_profit =
      Number(row.potential_profit ?? 0) === 0 ? potential.potentialProfit : row.potential_profit;
    row.profit_loss = roundMoney(Number(row.profit_loss ?? 0));
  }

  if (config.tableName === 'matched_bets') {
    const expected = calculateMatchedExpected({
      offerType: String(row.offer_type ?? 'otro') as any,
      backOdds: Number(row.back_odds ?? 0),
      backStake: Number(row.back_stake ?? 0),
      layOdds: Number(row.lay_odds ?? 0),
      layStake: Number(row.lay_stake ?? 0),
      layCommission: Number(row.lay_commission ?? 0),
      freebetAmount: Number(row.freebet_amount ?? 0),
    });

    row.lay_liability =
      Number(row.lay_liability ?? 0) === 0 ? expected.layLiability : row.lay_liability;
    row.expected_profit =
      Number(row.expected_profit ?? 0) === 0 ? expected.expectedProfit : row.expected_profit;
    row.roi = Number(row.roi ?? 0) === 0 ? expected.roi : row.roi;
    row.actual_profit = roundMoney(Number(row.actual_profit ?? 0));
    row.expected_actual_diff = roundMoney(Number(row.expected_actual_diff ?? 0));
  }

  if (config.tableName === 'pending_items') {
    row.status = row.status || 'pendiente';
    row.created_date = row.created_date || todayDbDate();
    row.investment_required = roundMoney(Number(row.investment_required ?? 0));
    row.expected_income = roundMoney(Number(row.expected_income ?? 0));
    row.expected_expense = roundMoney(Number(row.expected_expense ?? 0));
    row.expected_profit =
      Number(row.expected_profit ?? 0) === 0
        ? roundMoney(
            Number(row.expected_income ?? 0) -
              Number(row.expected_expense ?? 0) -
              Number(row.investment_required ?? 0),
          )
        : roundMoney(Number(row.expected_profit ?? 0));
    row.actual_profit = roundMoney(Number(row.actual_profit ?? 0));
    row.priority = Number(row.priority ?? 2) || 2;
  }
}

async function insertCsvRow(
  db: SQLiteDatabase,
  tableName: string,
  row: Record<string, unknown>,
  ignoreDuplicates: boolean,
): Promise<boolean> {
  const keys = Object.keys(row);
  const columns = keys.join(', ');
  const placeholders = keys.map(() => '?').join(', ');
  const verb = ignoreDuplicates ? 'INSERT OR IGNORE' : 'INSERT';
  const result = await db.runAsync(
    `${verb} INTO ${tableName} (${columns}) VALUES (${placeholders})`,
    keys.map((key) => row[key] ?? null) as any,
  );

  return (result.changes ?? 0) > 0;
}

async function clearTableForReplace(
  db: SQLiteDatabase,
  tableName: Exclude<CsvTableName, 'resumen_mensual'>,
): Promise<void> {
  if (tableName === 'accounts') {
    await db.runAsync('DELETE FROM transactions');
    await db.runAsync('DELETE FROM pending_items');
    await db.runAsync('DELETE FROM transfers');
    await db.runAsync('DELETE FROM bets');
    await db.runAsync('DELETE FROM matched_bets');
    await db.runAsync('DELETE FROM accounts');
    return;
  }

  if (tableName === 'bets') {
    await db.runAsync('DELETE FROM transactions WHERE related_bet_id IS NOT NULL');
    await db.runAsync('UPDATE pending_items SET related_bet_id = NULL');
    await db.runAsync('DELETE FROM bets');
    return;
  }

  if (tableName === 'matched_bets') {
    await db.runAsync('DELETE FROM transactions WHERE related_matched_bet_id IS NOT NULL');
    await db.runAsync('UPDATE pending_items SET related_matched_bet_id = NULL');
    await db.runAsync('DELETE FROM matched_bets');
    return;
  }

  if (tableName === 'transfers') {
    await db.runAsync('DELETE FROM transactions WHERE transfer_id IS NOT NULL');
    await db.runAsync('UPDATE pending_items SET related_transaction_id = NULL');
    await db.runAsync('DELETE FROM transfers');
    return;
  }

  await db.runAsync(`DELETE FROM ${tableName}`);
}

function getConfig(tableName: Exclude<CsvTableName, 'resumen_mensual'>): CsvTableConfig {
  const config = CSV_TABLE_CONFIGS.find((item) => item.tableName === tableName);

  if (!config) {
    throw new Error(`Tabla CSV no soportada: ${tableName}.`);
  }

  return config;
}

async function getStatisticsSheetRows(): Promise<Array<Record<string, unknown>>> {
  const rows: Array<Record<string, unknown>> = [];
  const roiBookmaker = await getAll<{ label: string; profit: number; stake: number }>(
    `SELECT COALESCE(a.name, 'Sin cuenta') AS label, SUM(b.profit_loss) AS profit, SUM(b.stake) AS stake
     FROM bets b
     LEFT JOIN accounts a ON a.id = b.bookmaker_account_id
     WHERE b.status <> 'pendiente'
     GROUP BY b.bookmaker_account_id`,
  );

  for (const row of roiBookmaker) {
    rows.push({
      metric: 'ROI por casa',
      label: row.label,
      profit: row.profit ?? 0,
      stake: row.stake ?? 0,
    });
  }

  return rows;
}

function toSheetName(label: string): string {
  return label.replace(/[\\/?*[\]:]/g, '').slice(0, 31);
}
