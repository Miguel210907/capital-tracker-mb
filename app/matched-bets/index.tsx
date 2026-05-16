import { useRouter } from 'expo-router';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../src/components/AppButton';
import { AppCard } from '../../src/components/AppCard';
import { EmptyState } from '../../src/components/EmptyState';
import { MoneyText } from '../../src/components/MoneyText';
import { Screen } from '../../src/components/Screen';
import { SectionTitle } from '../../src/components/SectionTitle';
import type { MatchedBetResult } from '../../src/domain/types';
import { useMatchedBets } from '../../src/hooks/useMatchedBets';
import { settleMatchedBet } from '../../src/services/matchedBettingService';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { formatSpanishDate } from '../../src/utils/dates';
import { formatPercent } from '../../src/utils/money';

export default function MatchedBetsScreen() {
  const router = useRouter();
  const { data, loading, refreshing, error, refresh } = useMatchedBets();

  async function handleSettle(id: string, result: MatchedBetResult) {
    try {
      await settleMatchedBet({ id, result });
      await refresh();
    } catch (unknownError) {
      Alert.alert('No se pudo liquidar', unknownError instanceof Error ? unknownError.message : 'Error desconocido.');
    }
  }

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <View style={styles.header}>
        <SectionTitle>Matched betting</SectionTitle>
        <AppButton title="Nueva" onPress={() => router.push('/matched-bets/new')} />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? <ActivityIndicator color={colors.primary} /> : null}
      {!loading && data?.length === 0 ? (
        <EmptyState title="Sin matched bets" body="Registra operaciones back/lay para controlar beneficio." />
      ) : null}

      {data?.map((matchedBet) => (
        <AppCard key={matchedBet.id}>
          <View style={styles.row}>
            <View style={styles.fill}>
              <Text style={styles.name}>{matchedBet.event}</Text>
              <Text style={styles.meta}>
                {formatSpanishDate(matchedBet.date)} | {matchedBet.offer_type} | {matchedBet.status}
              </Text>
              <Text style={styles.description}>
                Back {matchedBet.back_stake} @ {matchedBet.back_odds} | Lay {matchedBet.lay_stake} @ {matchedBet.lay_odds}
              </Text>
              <Text style={styles.meta}>ROI {formatPercent(matchedBet.roi)}%</Text>
            </View>
            <View style={styles.amounts}>
              <MoneyText value={matchedBet.expected_profit} tone="auto" style={styles.amount} />
              <MoneyText value={matchedBet.actual_profit} tone="auto" style={styles.pnl} />
            </View>
          </View>

          {matchedBet.status === 'pendiente' ? (
            <View style={styles.actions}>
              <AppButton title="Editar" onPress={() => router.push(`/matched-bets/new?id=${matchedBet.id}`)} variant="secondary" />
              <AppButton title="Gana back" onPress={() => handleSettle(matchedBet.id, 'gana_back')} variant="secondary" />
              <AppButton title="Pierde back" onPress={() => handleSettle(matchedBet.id, 'pierde_back')} variant="secondary" />
            </View>
          ) : (
            <View style={styles.actions}>
              <AppButton title="Editar" onPress={() => router.push(`/matched-bets/new?id=${matchedBet.id}`)} variant="secondary" />
            </View>
          )}
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
