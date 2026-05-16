import type { SQLiteDatabase } from 'expo-sqlite';

import { DEFAULT_CURRENCY, RESPONSIBLE_GAMBLING_SETTING_KEYS } from '../domain/constants';
import type { CategoryType } from '../domain/types';
import { nowIso } from '../utils/dates';
import { createId } from '../utils/ids';

interface DefaultCategory {
  name: string;
  type: CategoryType;
  color: string;
}

const DEFAULT_CATEGORIES: DefaultCategory[] = [
  { name: 'nomina', type: 'ingreso', color: '#2563eb' },
  { name: 'alquiler', type: 'ingreso', color: '#0f766e' },
  { name: 'intereses', type: 'ingreso', color: '#047857' },
  { name: 'dividendos', type: 'ingreso', color: '#059669' },
  { name: 'venta', type: 'ingreso', color: '#16a34a' },
  { name: 'devolucion', type: 'ingreso', color: '#65a30d' },
  { name: 'bonus', type: 'ingreso', color: '#0891b2' },
  { name: 'otro', type: 'ingreso', color: '#64748b' },

  { name: 'comida', type: 'gasto', color: '#dc2626' },
  { name: 'vivienda', type: 'gasto', color: '#ea580c' },
  { name: 'transporte', type: 'gasto', color: '#d97706' },
  { name: 'estudios', type: 'gasto', color: '#7c3aed' },
  { name: 'ocio', type: 'gasto', color: '#db2777' },
  { name: 'salud', type: 'gasto', color: '#be123c' },
  { name: 'impuestos', type: 'gasto', color: '#991b1b' },
  { name: 'inversion', type: 'gasto', color: '#4f46e5' },
  { name: 'apuestas', type: 'gasto', color: '#b91c1c' },
  { name: 'comisiones', type: 'gasto', color: '#92400e' },
  { name: 'otro', type: 'gasto', color: '#64748b' },

  { name: 'transferencia', type: 'transferencia', color: '#475569' },
  { name: 'ajuste', type: 'ajuste', color: '#64748b' },
  { name: 'stake apuesta', type: 'apuesta', color: '#9333ea' },
  { name: 'liquidacion apuesta', type: 'apuesta', color: '#16a34a' },
  { name: 'stake back', type: 'matched_betting', color: '#2563eb' },
  { name: 'liability lay', type: 'matched_betting', color: '#dc2626' },
  { name: 'liquidacion matched betting', type: 'matched_betting', color: '#0891b2' },
];

const DEFAULT_SETTINGS: Array<{ key: string; value: string }> = [
  { key: 'currency.default', value: DEFAULT_CURRENCY },
  { key: 'security.pin_enabled', value: 'false' },
  { key: 'security.biometrics_enabled', value: 'false' },
  { key: RESPONSIBLE_GAMBLING_SETTING_KEYS.dailyStakeLimit, value: '0' },
  { key: RESPONSIBLE_GAMBLING_SETTING_KEYS.weeklyStakeLimit, value: '0' },
  { key: RESPONSIBLE_GAMBLING_SETTING_KEYS.monthlyStakeLimit, value: '0' },
  { key: RESPONSIBLE_GAMBLING_SETTING_KEYS.monthlyLossLimit, value: '0' },
  {
    key: 'responsible.neutral_message',
    value: 'Esta app solo registra datos y no recomienda apostar.',
  },
  { key: 'onboarding.completed', value: 'false' },
];

export async function seedDefaultData(db: SQLiteDatabase): Promise<void> {
  const timestamp = nowIso();

  for (const category of DEFAULT_CATEGORIES) {
    await db.runAsync(
      `INSERT OR IGNORE INTO categories
        (id, name, type, color, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [createId('cat'), category.name, category.type, category.color, timestamp, timestamp],
    );
  }

  for (const setting of DEFAULT_SETTINGS) {
    await db.runAsync(
      `INSERT OR IGNORE INTO settings
        (id, key, value, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
      [createId('set'), setting.key, setting.value, timestamp, timestamp],
    );
  }
}
