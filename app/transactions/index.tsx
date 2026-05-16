import { useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../src/components/AppButton';
import { AppCard } from '../../src/components/AppCard';
import { EmptyState } from '../../src/components/EmptyState';
import { MoneyText } from '../../src/components/MoneyText';
import { Screen } from '../../src/components/Screen';
import { SectionTitle } from '../../src/components/SectionTitle';
import { useTransactions } from '../../src/hooks/useTransactions';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { formatSpanishDate } from '../../src/utils/dates';

export default function TransactionsScreen() {
  const router = useRouter();
  const { data, loading, refreshing, error, refresh } = useTransactions();

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <View style={styles.header}>
        <SectionTitle>Movimientos</SectionTitle>
        <AppButton title="Nuevo" onPress={() => router.push('/transactions/new')} />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? <ActivityIndicator color={colors.primary} /> : null}
      {!loading && data?.length === 0 ? (
        <EmptyState title="Sin movimientos" body="Registra ingresos, gastos o transferencias." />
      ) : null}
      {data?.map((transaction) => (
        <AppCard key={transaction.id}>
          <View style={styles.row}>
            <View style={styles.fill}>
              <Text style={styles.name}>{transaction.description || transaction.type}</Text>
              <Text style={styles.meta}>
                {formatSpanishDate(transaction.date)} | {transaction.type}
              </Text>
            </View>
            <MoneyText value={transaction.amount} tone="auto" style={styles.amount} />
          </View>
          <View style={styles.actions}>
            <AppButton
              title="Editar"
              onPress={() =>
                router.push(
                  transaction.transfer_id
                    ? `/transactions/new?transferId=${transaction.transfer_id}`
                    : transaction.related_bet_id
                      ? `/bets/new?id=${transaction.related_bet_id}`
                      : transaction.related_matched_bet_id
                        ? `/matched-bets/new?id=${transaction.related_matched_bet_id}`
                    : `/transactions/new?id=${transaction.id}`,
                )
              }
              variant="secondary"
            />
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
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  fill: {
    flex: 1,
  },
  name: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  meta: {
    color: colors.muted,
    fontSize: 13,
  },
  amount: {
    fontSize: 16,
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
