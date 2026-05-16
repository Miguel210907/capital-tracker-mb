import { useCallback } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { AppCard } from '../../src/components/AppCard';
import { MoneyText } from '../../src/components/MoneyText';
import { Screen } from '../../src/components/Screen';
import { SectionTitle } from '../../src/components/SectionTitle';
import { SimpleBarChart } from '../../src/components/SimpleBarChart';
import { StatCard } from '../../src/components/StatCard';
import { useRefreshable } from '../../src/hooks/useRefreshable';
import { getAdvancedStatistics } from '../../src/services/statisticsService';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { formatPercent } from '../../src/utils/money';

export default function StatsScreen() {
  const loader = useCallback(() => getAdvancedStatistics(), []);
  const { data, loading, refreshing, error, refresh } = useRefreshable(loader, [loader]);

  if (loading || !data) {
    return (
      <Screen>
        <ActivityIndicator color={colors.primary} />
      </Screen>
    );
  }

  const lastMonth = data.monthly[data.monthly.length - 1];

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <SectionTitle>Estadisticas</SectionTitle>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.grid}>
        <StatCard label="Capital estimado" value={lastMonth?.capital_estimado ?? 0} />
        <StatCard label="Dinero bloqueado" value={data.currentBlockedMoney} />
        <StatCard label="Dif. esperado/real MB" value={data.matchedExpectedActualDiff} tone="auto" />
        <StatCard label="ROI total %" value={data.totalRoi} money={false} />
        <StatCard label="Prevision pendientes" value={data.pendingExpectedProfitTotal} tone="auto" />
        <StatCard label="Capital previsto" value={data.projectedCapitalWithPending} tone="auto" />
      </View>

      <AppCard>
        <Text style={styles.title}>Pendientes</Text>
        <Text style={styles.text}>Beneficio previsto este mes: {data.pendingExpectedProfitMonth}</Text>
        <Text style={styles.text}>Beneficio previsto total: {data.pendingExpectedProfitTotal}</Text>
        <Text style={styles.text}>Completados: {data.pendingCompletedCount}</Text>
        <Text style={styles.text}>Cancelados: {data.pendingCancelledCount}</Text>
      </AppCard>

      <AppCard>
        <Text style={styles.title}>Evolucion mensual</Text>
        <SimpleBarChart
          data={data.monthly.map((month) => ({
            label: month.month,
            value: month.capital_estimado,
          }))}
        />
      </AppCard>

      <AppCard>
        <Text style={styles.title}>Beneficio neto mensual</Text>
        <SimpleBarChart
          data={data.monthly.map((month) => ({
            label: month.month,
            value:
              month.beneficio_neto + month.apuestas_profit_loss + month.matched_profit_loss,
          }))}
        />
      </AppCard>

      <StatsList title="ROI por casa" rows={data.roiByBookmaker} />
      <StatsList title="ROI por origen" rows={data.roiBySource} />
      <StatsList title="ROI por deporte" rows={data.roiBySport} />

      <AppCard>
        <Text style={styles.title}>Estados de apuestas</Text>
        {data.betCounts.length === 0 ? (
          <Text style={styles.text}>Sin apuestas registradas.</Text>
        ) : (
          data.betCounts.map((item) => (
            <Text key={item.status} style={styles.text}>
              {item.status}: {item.count}
            </Text>
          ))
        )}
      </AppCard>

      <TopBets title="Mejores apuestas" rows={data.topBestBets} />
      <TopBets title="Peores apuestas" rows={data.topWorstBets} />
    </Screen>
  );
}

function StatsList({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ label: string; profit: number; stake: number; roi: number }>;
}) {
  return (
    <AppCard>
      <Text style={styles.title}>{title}</Text>
      {rows.length === 0 ? (
        <Text style={styles.text}>Sin datos.</Text>
      ) : (
        rows.slice(0, 8).map((row) => (
          <View key={row.label} style={styles.row}>
            <View style={styles.fill}>
              <Text style={styles.name}>{row.label}</Text>
              <Text style={styles.meta}>ROI {formatPercent(row.roi)}% | stake {row.stake}</Text>
            </View>
            <MoneyText value={row.profit} tone="auto" style={styles.amount} />
          </View>
        ))
      )}
    </AppCard>
  );
}

function TopBets({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ id: string; date: string; event: string; profit_loss: number }>;
}) {
  return (
    <AppCard>
      <Text style={styles.title}>{title}</Text>
      {rows.length === 0 ? (
        <Text style={styles.text}>Sin datos.</Text>
      ) : (
        rows.map((row) => (
          <View key={row.id} style={styles.row}>
            <View style={styles.fill}>
              <Text style={styles.name}>{row.event}</Text>
              <Text style={styles.meta}>{row.date}</Text>
            </View>
            <MoneyText value={row.profit_loss} tone="auto" style={styles.amount} />
          </View>
        ))
      )}
    </AppCard>
  );
}

const styles = StyleSheet.create({
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
  text: {
    color: colors.text,
    fontSize: 15,
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
    fontSize: 14,
    fontWeight: '800',
  },
  meta: {
    color: colors.muted,
    fontSize: 12,
  },
  amount: {
    fontSize: 15,
    fontWeight: '900',
  },
  error: {
    color: colors.danger,
  },
});
