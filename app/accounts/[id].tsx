import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../src/components/AppButton';
import { AppCard } from '../../src/components/AppCard';
import { EmptyState } from '../../src/components/EmptyState';
import { MoneyText } from '../../src/components/MoneyText';
import { Screen } from '../../src/components/Screen';
import { SectionTitle } from '../../src/components/SectionTitle';
import { getAccountById, getAccountTransactions } from '../../src/services/accountService';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { formatSpanishDate } from '../../src/utils/dates';
import { useRefreshable } from '../../src/hooks/useRefreshable';

export default function AccountDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const accountId = String(params.id);
  const loader = useCallback(async () => {
    const [account, transactions] = await Promise.all([
      getAccountById(accountId),
      getAccountTransactions(accountId),
    ]);
    return { account, transactions };
  }, [accountId]);
  const { data, loading, refreshing, refresh, error } = useRefreshable(loader, [loader]);

  if (loading || !data) {
    return (
      <Screen>
        <ActivityIndicator color={colors.primary} />
      </Screen>
    );
  }

  if (!data.account) {
    return (
      <Screen>
        <EmptyState title="Cuenta no encontrada" />
      </Screen>
    );
  }

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <SectionTitle>{data.account.name}</SectionTitle>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <AppCard>
        <Text style={styles.meta}>{data.account.type} | {data.account.currency}</Text>
        <MoneyText value={data.account.current_balance} style={styles.balance} />
        {data.account.notes ? <Text style={styles.notes}>{data.account.notes}</Text> : null}
      </AppCard>

      <AppButton
        title="Nuevo movimiento"
        onPress={() => router.push(`/transactions/new?accountId=${accountId}`)}
      />
      <AppButton
        title="Editar cuenta"
        onPress={() => router.push(`/accounts/new?id=${accountId}`)}
        variant="secondary"
      />

      <SectionTitle>Historial</SectionTitle>
      {data.transactions.length === 0 ? (
        <EmptyState title="Sin movimientos" />
      ) : (
        data.transactions.map((transaction) => (
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
          </AppCard>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
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
  balance: {
    fontSize: 28,
    fontWeight: '900',
  },
  amount: {
    fontSize: 16,
    fontWeight: '800',
  },
  notes: {
    color: colors.text,
  },
  error: {
    color: colors.danger,
  },
});
