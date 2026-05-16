import { useCallback } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../src/components/AppButton';
import { AppCard } from '../../src/components/AppCard';
import { Screen } from '../../src/components/Screen';
import { SectionTitle } from '../../src/components/SectionTitle';
import { useRefreshable } from '../../src/hooks/useRefreshable';
import { exportDiagnosticLogText, runDiagnostics } from '../../src/services/diagnosticsService';
import { saveTextFile, shareFile, timestampForFileName } from '../../src/services/fileService';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';

export default function DiagnosticsScreen() {
  const loader = useCallback(() => runDiagnostics(), []);
  const { data, loading, refreshing, error, refresh } = useRefreshable(loader, [loader]);

  async function handleExportLogs() {
    try {
      const contents = await exportDiagnosticLogText();
      const saved = await saveTextFile(
        `capital-tracker-mb-diagnostics-${timestampForFileName()}.txt`,
        contents,
        'export',
      );
      await shareFile(saved.uri);
      Alert.alert('Logs exportados', saved.fileName);
    } catch (unknownError) {
      Alert.alert('No se pudo exportar', unknownError instanceof Error ? unknownError.message : 'Error desconocido.');
    }
  }

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <SectionTitle>Diagnostico</SectionTitle>
      <AppButton title="Exportar logs" onPress={handleExportLogs} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? <ActivityIndicator color={colors.primary} /> : null}
      {data?.map((item) => (
        <AppCard key={item.label}>
          <View style={styles.row}>
            <View style={[styles.dot, getStatusStyle(item.status)]} />
            <View style={styles.fill}>
              <Text style={styles.title}>{item.label}</Text>
              <Text style={styles.text}>{item.value}</Text>
            </View>
          </View>
        </AppCard>
      ))}
    </Screen>
  );
}

function getStatusStyle(status: 'ok' | 'warning' | 'danger') {
  if (status === 'ok') {
    return styles.ok;
  }
  if (status === 'warning') {
    return styles.warning;
  }
  return styles.danger;
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
  dot: {
    borderRadius: 6,
    height: 12,
    width: 12,
  },
  ok: {
    backgroundColor: colors.success,
  },
  warning: {
    backgroundColor: colors.warning,
  },
  danger: {
    backgroundColor: colors.danger,
  },
  title: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  text: {
    color: colors.muted,
    fontSize: 13,
  },
  error: {
    color: colors.danger,
  },
});
