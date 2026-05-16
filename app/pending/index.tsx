import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../src/components/AppButton';
import { AppCard } from '../../src/components/AppCard';
import { AppInput } from '../../src/components/AppInput';
import { AppSelect } from '../../src/components/AppSelect';
import { EmptyState } from '../../src/components/EmptyState';
import { MoneyText } from '../../src/components/MoneyText';
import { Screen } from '../../src/components/Screen';
import { SectionTitle } from '../../src/components/SectionTitle';
import { StatCard } from '../../src/components/StatCard';
import { PENDING_ITEM_STATUSES, PENDING_ITEM_TYPES } from '../../src/domain/constants';
import type { PendingItemStatus } from '../../src/domain/types';
import { useRefreshable } from '../../src/hooks/useRefreshable';
import {
  deletePendingItem,
  getPendingSummary,
  listPendingItems,
  setPendingItemStatus,
} from '../../src/services/pendingService';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { formatSpanishDate } from '../../src/utils/dates';

export default function PendingItemsScreen() {
  const router = useRouter();
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [text, setText] = useState('');

  const loader = useCallback(async () => {
    const [items, summary] = await Promise.all([
      listPendingItems({
        status: status || undefined,
        type: type || undefined,
        text: text || undefined,
      }),
      getPendingSummary(),
    ]);

    return { items, summary };
  }, [status, type, text]);

  const { data, loading, refreshing, error, refresh } = useRefreshable(loader);

  async function updateStatus(id: string, nextStatus: PendingItemStatus) {
    try {
      await setPendingItemStatus(id, nextStatus);
      await refresh();
    } catch (unknownError) {
      Alert.alert(
        'No se pudo actualizar',
        unknownError instanceof Error ? unknownError.message : 'Error desconocido.',
      );
    }
  }

  function confirmDelete(id: string) {
    Alert.alert('Eliminar pendiente', 'Esta accion no se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await deletePendingItem(id);
            await refresh();
          } catch (unknownError) {
            Alert.alert(
              'No se pudo eliminar',
              unknownError instanceof Error ? unknownError.message : 'Error desconocido.',
            );
          }
        },
      },
    ]);
  }

  const items = data?.items ?? [];
  const summary = data?.summary;

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <View style={styles.header}>
        <SectionTitle>Pendientes</SectionTitle>
        <AppButton title="Nuevo" onPress={() => router.push('/pending/new')} />
      </View>

      {summary ? (
        <View style={styles.grid}>
          <StatCard label="Previsto este mes" value={summary.expectedProfitMonth} tone="auto" />
          <StatCard label="Previsto total" value={summary.expectedProfitTotal} tone="auto" />
          <StatCard label="Por cobrar" value={summary.expectedIncomeTotal} tone="auto" />
          <StatCard label="Por invertir" value={summary.investmentRequiredTotal} />
          <StatCard label="Vencidos" value={summary.overdueCount} money={false} />
          <StatCard label="Proximos 7 dias" value={summary.nextSevenDaysCount} money={false} />
        </View>
      ) : null}

      <AppCard>
        <Text style={styles.title}>Filtros</Text>
        <AppInput label="Buscar" value={text} onChangeText={setText} placeholder="Venta, bonus, suscripcion..." />
        <AppSelect
          label="Estado"
          value={status}
          options={[
            { label: 'Todos', value: '' },
            ...PENDING_ITEM_STATUSES.map((itemStatus) => ({
              label: itemStatus.replace('_', ' '),
              value: itemStatus,
            })),
          ]}
          onChange={setStatus}
        />
        <AppSelect
          label="Tipo"
          value={type}
          options={[
            { label: 'Todos', value: '' },
            ...PENDING_ITEM_TYPES.map((itemType) => ({
              label: itemType.replace('_', ' '),
              value: itemType,
            })),
          ]}
          onChange={setType}
        />
        <AppButton title="Aplicar filtros" onPress={() => void refresh()} variant="secondary" />
      </AppCard>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? <ActivityIndicator color={colors.primary} /> : null}
      {!loading && items.length === 0 ? (
        <EmptyState
          title="Sin pendientes"
          body="Anade cobros, ventas, suscripciones u oportunidades previstas."
        />
      ) : null}

      {items.map((item) => (
        <AppCard key={item.id}>
          <View style={styles.row}>
            <View style={styles.fill}>
              <Text style={styles.name}>{item.title}</Text>
              <Text style={styles.meta}>
                {item.type.replace('_', ' ')} | {item.status.replace('_', ' ')}
              </Text>
              <Text style={styles.meta}>
                Creado {formatSpanishDate(item.created_date)}
                {item.expected_date ? ` | Previsto ${formatSpanishDate(item.expected_date)}` : ''}
              </Text>
            </View>
            <View style={styles.amounts}>
              <MoneyText value={item.expected_profit} tone="auto" style={styles.amount} />
              <Text style={styles.meta}>Invierte</Text>
              <MoneyText value={item.investment_required} style={styles.smallAmount} />
            </View>
          </View>
          <View style={styles.actions}>
            <AppButton title="Editar" onPress={() => router.push(`/pending/new?id=${item.id}`)} variant="secondary" />
            {item.status !== 'completado' ? (
              <AppButton
                title="Completado"
                onPress={() => void updateStatus(item.id, 'completado')}
                variant="secondary"
              />
            ) : null}
            {item.status !== 'cancelado' ? (
              <AppButton
                title="Cancelar"
                onPress={() => void updateStatus(item.id, 'cancelado')}
                variant="secondary"
              />
            ) : null}
            <AppButton title="Eliminar" onPress={() => confirmDelete(item.id)} variant="danger" />
          </View>
        </AppCard>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  fill: {
    flex: 1,
  },
  name: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  meta: {
    color: colors.muted,
    fontSize: 12,
    marginTop: spacing.xs,
  },
  amounts: {
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: 16,
    fontWeight: '900',
  },
  smallAmount: {
    fontSize: 13,
    fontWeight: '800',
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  error: {
    color: colors.danger,
  },
});
