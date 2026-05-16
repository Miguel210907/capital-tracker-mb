import { getFirst, withTransaction } from '../database';
import { nowIso } from '../../utils/dates';
import { createId } from '../../utils/ids';

export async function getSettingValue(key: string, fallback = ''): Promise<string> {
  const row = await getFirst<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]);
  return row?.value ?? fallback;
}

export async function setSettingValue(key: string, value: string): Promise<void> {
  await withTransaction(async (db) => {
    const timestamp = nowIso();
    await db.runAsync(
      `INSERT INTO settings (id, key, value, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [createId('set'), key, value, timestamp, timestamp],
    );
  });
}

export async function getNumberSetting(key: string, fallback = 0): Promise<number> {
  const value = await getSettingValue(key, String(fallback));
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function setNumberSetting(key: string, value: number): Promise<void> {
  await setSettingValue(key, String(value));
}
