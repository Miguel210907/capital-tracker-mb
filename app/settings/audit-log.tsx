import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { AppCard } from '../../src/components/AppCard';
import { AppInput } from '../../src/components/AppInput';
import { AppSelect } from '../../src/components/AppSelect';
import { Screen } from '../../src/components/Screen';
import { SectionTitle } from '../../src/components/SectionTitle';
import type { AuditAction } from '../../src/domain/types';
import { useRefreshable } from '../../src/hooks/useRefreshable';
import { listAuditLogs } from '../../src/services/auditLogService';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';

export default function AuditLogScreen() {
  const [action, setAction] = useState<AuditAction | ''>('');
  const [tableName, setTableName] = useState('');
  const loader = useCallback(
    () => listAuditLogs({ action, tableName: tableName.trim() || undefined }),
    [action, tableName],
  );
  const { data, loading, refreshing, error, refresh } = useRefreshable(loader, [loader]);

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <SectionTitle>Historial de cambios</SectionTitle>
      <AppSelect
        label="Accion"
        value={action}
        options={[
          { label: 'Todas', value: '' },
          { label: 'Crear', value: 'create' },
          { label: 'Editar', value: 'update' },
          { label: 'Borrar', value: 'delete' },
          { label: 'Importar', value: 'import' },
          { label: 'Restaurar', value: 'restore' },
          { label: 'Recalcular', value: 'recalculate' },
        ]}
        onChange={(value) => setAction(value as AuditAction | '')}
      />
      <AppInput label="Tabla" value={tableName} onChangeText={setTableName} placeholder="accounts, bets..." />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? <ActivityIndicator color={colors.primary} /> : null}
      {data?.map((item) => (
        <AppCard key={item.id}>
          <View style={styles.row}>
            <View style={styles.fill}>
              <Text style={styles.title}>{item.action} | {item.table_name}</Text>
              <Text style={styles.meta}>{item.date}</Text>
              <Text style={styles.meta}>{item.record_id ?? 'sin id'}</Text>
            </View>
          </View>
        </AppCard>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  fill: {
    flex: 1,
  },
  title: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  meta: {
    color: colors.muted,
    fontSize: 12,
  },
  error: {
    color: colors.danger,
  },
});
