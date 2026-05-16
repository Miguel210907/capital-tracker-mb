import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { roundMoney } from '../utils/money';

interface ChartItem {
  label: string;
  value: number;
}

interface SimpleBarChartProps {
  data: ChartItem[];
  maxItems?: number;
}

export function SimpleBarChart({ data, maxItems = 8 }: SimpleBarChartProps) {
  const visible = data.slice(-maxItems);
  const max = Math.max(...visible.map((item) => Math.abs(item.value)), 1);

  return (
    <View style={styles.container}>
      {visible.map((item) => {
        const width = `${Math.max(4, (Math.abs(item.value) / max) * 100)}%`;
        const positive = item.value >= 0;

        return (
          <View key={item.label} style={styles.row}>
            <Text style={styles.label}>{item.label}</Text>
            <View style={styles.track}>
              <View
                style={[
                  styles.bar,
                  { width },
                  { backgroundColor: positive ? colors.primary : colors.danger },
                ]}
              />
            </View>
            <Text style={styles.value}>{roundMoney(item.value)}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  row: {
    gap: spacing.xs,
  },
  label: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  track: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 8,
    height: 12,
    overflow: 'hidden',
  },
  bar: {
    borderRadius: 8,
    height: 12,
  },
  value: {
    color: colors.text,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
});
