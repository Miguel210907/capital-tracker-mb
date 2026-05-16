import type { SQLiteDatabase } from 'expo-sqlite';

import { getAll, withTransaction } from '../db/database';
import { createAuditLog } from '../db/repositories/auditLogRepository';
import type {
  Account,
  AuditLog,
  Bet,
  Category,
  MatchedBet,
  PendingItem,
  Setting,
  Transaction,
  Transfer,
} from '../domain/types';
import { nowIso } from '../utils/dates';
import { createId } from '../utils/ids';
import { saveTextFile, shareFile, timestampForFileName, type SavedFile } from './fileService';

type BackupFormatVersion = 1 | 2;

export interface BackupData {
  format: 'capital-tracker-mb-backup';
  version: BackupFormatVersion;
  created_at: string;
  tables: {
    accounts: Account[];
    bets: Bet[];
    matched_bets: MatchedBet[];
    pending_items: PendingItem[];
    transfers: Transfer[];
    transactions: Transaction[];
    categories: Category[];
    settings: Setting[];
    audit_log: AuditLog[];
    import_batches: Record<string, unknown>[];
    backups: Record<string, unknown>[];
  };
}

export interface BackupResult extends SavedFile {
  shared: boolean;
}

const TABLE_READ_ORDER = [
  'accounts',
  'bets',
  'matched_bets',
  'pending_items',
  'transfers',
  'transactions',
  'categories',
  'settings',
  'audit_log',
  'import_batches',
  'backups',
] as const;

const DELETE_ORDER = [
  'transactions',
  'pending_items',
  'transfers',
  'bets',
  'matched_bets',
  'categories',
  'settings',
  'audit_log',
  'import_batches',
  'backups',
  'accounts',
] as const;

const INSERT_ORDER = [
  'accounts',
  'bets',
  'matched_bets',
  'transfers',
  'transactions',
  'pending_items',
  'categories',
  'settings',
  'audit_log',
  'import_batches',
  'backups',
] as const;

export async function buildBackupData(): Promise<BackupData> {
  const tables = {
    accounts: await getAll<Account>('SELECT * FROM accounts ORDER BY created_at ASC'),
    bets: await getAll<Bet>('SELECT * FROM bets ORDER BY created_at ASC'),
    matched_bets: await getAll<MatchedBet>('SELECT * FROM matched_bets ORDER BY created_at ASC'),
    pending_items: await getAll<PendingItem>('SELECT * FROM pending_items ORDER BY created_at ASC'),
    transfers: await getAll<Transfer>('SELECT * FROM transfers ORDER BY created_at ASC'),
    transactions: await getAll<Transaction>('SELECT * FROM transactions ORDER BY created_at ASC'),
    categories: await getAll<Category>('SELECT * FROM categories ORDER BY created_at ASC'),
    settings: await getAll<Setting>('SELECT * FROM settings ORDER BY created_at ASC'),
    audit_log: await getAll<AuditLog>('SELECT * FROM audit_log ORDER BY created_at ASC'),
    import_batches: await getAll<Record<string, unknown>>(
      'SELECT * FROM import_batches ORDER BY created_at ASC',
    ),
    backups: await getAll<Record<string, unknown>>('SELECT * FROM backups ORDER BY created_at ASC'),
  };

  return {
    format: 'capital-tracker-mb-backup',
    version: 2,
    created_at: nowIso(),
    tables,
  };
}

export async function exportJsonBackup(options: { share?: boolean } = {}): Promise<BackupResult> {
  const backup = await buildBackupData();
  const fileName = `capital-tracker-mb-backup-${timestampForFileName()}.json`;
  const saved = await saveTextFile(fileName, JSON.stringify(backup, null, 2), 'backup');

  await withTransaction(async (db) => {
    await db.runAsync(
      `INSERT INTO backups
        (id, date, file_name, format, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        createId('bak'),
        backup.created_at,
        saved.fileName,
        'json',
        'Backup JSON completo',
        nowIso(),
      ],
    );

    await createAuditLog(db, {
      action: 'create',
      tableName: 'backups',
      recordId: saved.fileName,
      newValue: { fileName: saved.fileName, format: 'json' },
    });
  });

  const shared = options.share === false ? false : await shareFile(saved.uri);
  return { ...saved, shared };
}

export function parseBackupJson(content: string): BackupData {
  const parsed = JSON.parse(content) as BackupData;

  if (
    parsed.format !== 'capital-tracker-mb-backup' ||
    (parsed.version !== 1 && parsed.version !== 2)
  ) {
    throw new Error('El archivo no es una copia de seguridad compatible.');
  }

  const requiredTables = TABLE_READ_ORDER.filter((tableName) => {
    return parsed.version === 2 || tableName !== 'pending_items';
  });

  for (const tableName of requiredTables) {
    if (!Array.isArray(parsed.tables?.[tableName])) {
      throw new Error(`La copia no contiene la tabla ${tableName}.`);
    }
  }

  if (!Array.isArray(parsed.tables.pending_items)) {
    parsed.tables.pending_items = [];
  }

  return parsed;
}

export async function restoreJsonBackup(content: string): Promise<void> {
  const backup = parseBackupJson(content);

  await withTransaction(async (db) => {
    for (const tableName of DELETE_ORDER) {
      await db.runAsync(`DELETE FROM ${tableName}`);
    }

    for (const tableName of INSERT_ORDER) {
      const rows = backup.tables[tableName];
      for (const row of rows) {
        await insertGenericRow(db, tableName, row as Record<string, unknown>);
      }
    }

    await createAuditLog(db, {
      action: 'restore',
      tableName: 'all',
      newValue: { restored_at: nowIso(), backup_created_at: backup.created_at },
    });
  });
}

export async function createAutomaticBackupBeforeImport(): Promise<SavedFile> {
  const result = await exportJsonBackup({ share: false });
  return {
    uri: result.uri,
    fileName: result.fileName,
    createdAt: result.createdAt,
  };
}

async function insertGenericRow(
  db: SQLiteDatabase,
  tableName: string,
  row: Record<string, unknown>,
): Promise<void> {
  const keys = Object.keys(row);

  if (keys.length === 0) {
    return;
  }

  const placeholders = keys.map(() => '?').join(', ');
  const columns = keys.join(', ');
  const values = keys.map((key) => row[key] ?? null);

  await db.runAsync(`INSERT INTO ${tableName} (${columns}) VALUES (${placeholders})`, values as any);
}
