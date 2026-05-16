import { useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../src/components/AppButton';
import { AppCard } from '../src/components/AppCard';
import { Screen } from '../src/components/Screen';
import { SectionTitle } from '../src/components/SectionTitle';
import { StatCard } from '../src/components/StatCard';
import { useDashboard } from '../src/hooks/useDashboard';
import { colors } from '../src/theme/colors';
import { spacing } from '../src/theme/spacing';
import { formatPercent } from '../src/utils/money';

export default function DashboardScreen() {
  const router = useRouter();
  const { data, loading, refreshing, error, refresh } = useDashboard();

  if (loading || !data) {
    return (
      <Screen>
        <ActivityIndicator color={colors.primary} />
      </Screen>
    );
  }

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <SectionTitle>Dashboard</SectionTitle>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.grid}>
        <StatCard label="Capital total" value={data.capital_total} />
        <StatCard label="Capital disponible" value={data.capital_disponible} />
        <StatCard label="Bloqueado apuestas" value={data.dinero_bloqueado_apuestas} />
        <StatCard
          label="Bloqueado matched"
          value={data.dinero_bloqueado_matched_betting}
        />
        <StatCard label="Ingresos mes" value={data.ingresos_mes} tone="auto" />
        <StatCard label="Gastos mes" value={data.gastos_mes} />
        <StatCard label="P/L apuestas mes" value={data.apuestas_profit_loss_mes} tone="auto" />
        <StatCard label="P/L matched mes" value={data.matched_profit_loss_mes} tone="auto" />
      </View>

      <AppCard>
        <Text style={styles.cardTitle}>Control de apuestas</Text>
        <Text style={styles.line}>Pendientes: {data.apuestas_pendientes}</Text>
        <Text style={styles.line}>ROI apuestas: {formatPercent(data.roi_apuestas)}%</Text>
        <Text style={styles.line}>
          ROI matched betting: {formatPercent(data.roi_matched_betting)}%
        </Text>
        <Text style={styles.notice}>Esta app solo registra datos y no recomienda apostar.</Text>
      </AppCard>

      <View style={styles.quickActions}>
        <AppButton title="Anadir ingreso" onPress={() => router.push('/transactions/new?type=ingreso')} />
        <AppButton title="Anadir gasto" onPress={() => router.push('/transactions/new?type=gasto')} />
        <AppButton title="Transferencia" onPress={() => router.push('/transactions/new?type=transferencia')} variant="secondary" />
        <AppButton title="Anadir apuesta" onPress={() => router.push('/bets/new')} variant="secondary" />
        <AppButton title="Matched bet" onPress={() => router.push('/matched-bets/new')} variant="secondary" />
      </View>

      <AppCard>
        <Text style={styles.cardTitle}>Secciones</Text>
        <View style={styles.quickActions}>
          <AppButton title="Cuentas" onPress={() => router.push('/accounts')} variant="secondary" />
          <AppButton title="Movimientos" onPress={() => router.push('/transactions')} variant="secondary" />
          <AppButton title="Apuestas" onPress={() => router.push('/bets')} variant="secondary" />
          <AppButton title="Matched betting" onPress={() => router.push('/matched-bets')} variant="secondary" />
          <AppButton title="Estadisticas" onPress={() => router.push('/stats')} variant="secondary" />
          <AppButton title="Ajustes" onPress={() => router.push('/settings')} variant="secondary" />
        </View>
      </AppCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  quickActions: {
    gap: spacing.sm,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  line: {
    color: colors.text,
    fontSize: 15,
  },
  notice: {
    color: colors.muted,
    fontSize: 13,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
  },
});
