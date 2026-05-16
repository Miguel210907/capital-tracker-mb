import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../src/components/AppButton';
import { AppCard } from '../../src/components/AppCard';
import { EmptyState } from '../../src/components/EmptyState';
import { MoneyText } from '../../src/components/MoneyText';
import { Screen } from '../../src/components/Screen';
import { SectionTitle } from '../../src/components/SectionTitle';
import { useAccounts } from '../../src/hooks/useAccounts';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';

export default function AccountsScreen() {
  const router = useRouter();
  const { data, loading, refreshing, error, refresh } = useAccounts();

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <View style={styles.header}>
        <SectionTitle>Cuentas</SectionTitle>
        <AppButton title="Nueva" onPress={() => router.push('/accounts/new')} />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? <ActivityIndicator color={colors.primary} /> : null}

      {!loading && data?.length === 0 ? (
        <EmptyState
          title="Sin cuentas"
          body="Crea tu primera cuenta para empezar a registrar capital."
        />
      ) : null}

      {data?.map((account) => (
        <Pressable key={account.id} onPress={() => router.push(`/accounts/${account.id}`)}>
          <AppCard>
            <View style={styles.row}>
              <View style={styles.fill}>
                <Text style={styles.name}>{account.name}</Text>
                <Text style={styles.meta}>{account.type} | {account.currency}</Text>
              </View>
              <MoneyText value={account.current_balance} style={styles.balance} />
            </View>
          </AppCard>
        </Pressable>
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
    fontSize: 17,
    fontWeight: '800',
  },
  meta: {
    color: colors.muted,
    fontSize: 13,
    marginTop: spacing.xs,
  },
  balance: {
    fontSize: 17,
    fontWeight: '800',
  },
  error: {
    color: colors.danger,
  },
});
