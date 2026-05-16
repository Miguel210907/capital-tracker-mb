import * as SQLite from 'expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';

import { seedDefaultData } from './seed';
import { INDEX_SQL, SCHEMA_SQL } from './schema';

const DATABASE_NAME = 'capital_tracker_mb.db';

let dbPromise: Promise<SQLiteDatabase> | null = null;

export async function getDatabase(): Promise<SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DATABASE_NAME);
  }

  return dbPromise;
}

export async function initializeDatabase(): Promise<void> {
  const db = await getDatabase();

  for (const statement of SCHEMA_SQL) {
    await db.execAsync(statement);
  }

  for (const statement of INDEX_SQL) {
    await db.execAsync(statement);
  }

  await seedDefaultData(db);
}

export function sqlParams(params: readonly unknown[] = []) {
  return params.map((value) => (value === undefined ? null : value)) as any;
}

export async function runSql(sql: string, params: unknown[] = []) {
  const db = await getDatabase();
  return db.runAsync(sql, sqlParams(params));
}

export async function getFirst<T>(sql: string, params: unknown[] = []): Promise<T | null> {
  const db = await getDatabase();
  return db.getFirstAsync<T>(sql, sqlParams(params));
}

export async function getAll<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const db = await getDatabase();
  return db.getAllAsync<T>(sql, sqlParams(params));
}

export async function withTransaction<T>(
  work: (db: SQLiteDatabase) => Promise<T>,
): Promise<T> {
  const db = await getDatabase();

  await db.execAsync('BEGIN IMMEDIATE TRANSACTION');
  try {
    const result = await work(db);
    await db.execAsync('COMMIT');
    return result;
  } catch (error) {
    await db.execAsync('ROLLBACK');
    throw error;
  }
}

export async function closeDatabaseForTests(): Promise<void> {
  if (!dbPromise) {
    return;
  }

  const db = await dbPromise;
  await db.closeAsync();
  dbPromise = null;
}
