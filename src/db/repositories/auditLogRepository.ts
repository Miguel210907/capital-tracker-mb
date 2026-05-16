import type { SQLiteDatabase } from 'expo-sqlite';

import type { AuditAction, AuditLog } from '../../domain/types';
import { nowIso } from '../../utils/dates';
import { createId } from '../../utils/ids';

interface AuditInput {
  action: AuditAction;
  tableName: string;
  recordId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
}

function serializeAuditValue(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  return JSON.stringify(value);
}

export async function createAuditLog(
  db: SQLiteDatabase,
  input: AuditInput,
): Promise<AuditLog> {
  const timestamp = nowIso();
  const auditLog: AuditLog = {
    id: createId('aud'),
    date: timestamp,
    action: input.action,
    table_name: input.tableName,
    record_id: input.recordId ?? null,
    old_value: serializeAuditValue(input.oldValue),
    new_value: serializeAuditValue(input.newValue),
    created_at: timestamp,
  };

  await db.runAsync(
    `INSERT INTO audit_log
      (id, date, action, table_name, record_id, old_value, new_value, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      auditLog.id,
      auditLog.date,
      auditLog.action,
      auditLog.table_name,
      auditLog.record_id,
      auditLog.old_value,
      auditLog.new_value,
      auditLog.created_at,
    ],
  );

  return auditLog;
}
