import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';

interface AppLogoProps {
  compact?: boolean;
}

export function AppLogo({ compact = false }: AppLogoProps) {
  return (
    <View style={[styles.container, compact && styles.compact]}>
      <View style={[styles.mark, compact && styles.markCompact]}>
        <Text style={[styles.markText, compact && styles.markTextCompact]}>MB</Text>
      </View>
      {!compact ? (
        <View>
          <Text style={styles.title}>Capital Tracker MB</Text>
          <Text style={styles.subtitle}>Capital, apuestas y prevision</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  compact: {
    gap: 0,
  },
  mark: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 12,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  markCompact: {
    borderRadius: 10,
    height: 36,
    width: 36,
  },
  markText: {
    color: colors.surface,
    fontSize: 18,
    fontWeight: '900',
  },
  markTextCompact: {
    fontSize: 14,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
});
