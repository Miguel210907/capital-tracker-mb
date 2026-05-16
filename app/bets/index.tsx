import { useRouter } from 'expo-router';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../src/components/AppButton';
import { AppCard } from '../../src/components/AppCard';
import { EmptyState } from '../../src/components/EmptyState';
import { MoneyText } from '../../src/components/MoneyText';
import { Screen } from '../../src/components/Screen';
import { SectionTitle } from '../../src/components/SectionTitle';
import type { BetStatus } from '../../src/domain/types';
import { useBets } from '../../src/hooks/useBets';
import { settleBet } from '../../src/services/bettingService';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { formatSpanishDate } from '../../src/utils/dates';

export default function BetsScreen() {
  const router = useRouter();
  const { data, loading, refreshing, error, refresh } = useBets();

  async function handleSettle(id: string, status: Exclude<BetStatus, 'pendiente'>) {
    try {
      await settleBet({ id, status });
      await refresh();
    } catch (unknownError) {
      Alert.alert('No se pudo liquidar', unknownError instanceof Error ? unknownError.message : 'Error desconocido.');
    }
  }

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <View style={styles.header}>
        <SectionTitle>Apuestas</SectionTitle>
        <AppButton title="Nueva" onPress={() => router.push('/bets/new')} />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? <ActivityIndicator color={colors.primary} /> : null}
      {!loading && data?.length === 0 ? (
        <EmptyState title="Sin apuestas" body="Registra apuestas pendientes y liquidalas despues." />
      ) : null}

      {data?.map((bet) => (
        <AppCard key={bet.id}>
          <View style={styles.row}>
            <View style={styles.fill}>
              <Text style={styles.name}>{bet.event}</Text>
              <Text style={styles.meta}>
                {formatSpanishDate(bet.date)} | {bet.status} | cuota {bet.odds}
              </Text>
              <Text style={styles.description}>{bet.bet_description}</Text>
            </View>
            <View style={styles.amounts}>
              <MoneyText value={bet.stake} style={styles.amount} />
              <MoneyText value={bet.profit_loss} tone="auto" style={styles.pnl} />
            </View>
          </View>

          {bet.status === 'pendiente' ? (
            <View style={styles.actions}>
              <AppButton title="Ganada" onPress={() => handleSettle(bet.id, 'ganada')} variant="secondary" />
              <AppButton title="Perdida" onPress={() => handleSettle(bet.id, 'perdida')} variant="secondary" />
              <AppButton title="Nula" onPress={() => handleSettle(bet.id, 'nula')} variant="secondary" />
            </View>
          ) : null}
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
    fontSize: 13,
    marginTop: spacing.xs,
  },
  description: {
    color: colors.text,
    fontSize: 14,
    marginTop: spacing.xs,
  },
  amounts: {
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: 14,
    fontWeight: '700',
  },
  pnl: {
    fontSize: 16,
    fontWeight: '900',
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  error: {
    color: colors.danger,
  },
});
