import { getAll } from '../db/database';
import type { AuditAction, AuditLog } from '../domain/types';

export interface AuditLogFilter {
  from?: string;
  to?: string;
  action?: AuditAction | '';
  tableName?: string;
}

export async function listAuditLogs(filter: AuditLogFilter = {}): Promise<AuditLog[]> {
  const where: string[] = [];
  const params: unknown[] = [];

  if (filter.from) {
    where.push('date >= ?');
    params.push(filter.from);
  }

  if (filter.to) {
    where.push('date <= ?');
    params.push(filter.to);
  }

  if (filter.action) {
    where.push('action = ?');
    params.push(filter.action);
  }

  if (filter.tableName) {
    where.push('table_name = ?');
    params.push(filter.tableName);
  }

  return getAll<AuditLog>(
    `SELECT * FROM audit_log
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY date DESC
     LIMIT 300`,
    params,
  );
}
