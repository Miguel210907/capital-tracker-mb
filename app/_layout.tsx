import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StatusBar, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { initializeDatabase } from '../src/db/database';
import { SecurityGate } from '../src/components/SecurityGate';
import { colors } from '../src/theme/colors';
import { spacing } from '../src/theme/spacing';

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initializeDatabase()
      .then(() => setReady(true))
      .catch((unknownError) => {
        const message =
          unknownError instanceof Error ? unknownError.message : 'Error inicializando SQLite.';
        setError(message);
      });
  }, []);

  if (error) {
    return (
      <SafeAreaProvider>
        <View style={{ flex: 1, padding: spacing.lg, justifyContent: 'center' }}>
          <Text style={{ color: colors.danger, fontSize: 17, fontWeight: '700' }}>
            No se pudo abrir la base de datos
          </Text>
          <Text style={{ color: colors.text, marginTop: spacing.sm }}>{error}</Text>
        </View>
      </SafeAreaProvider>
    );
  }

  if (!ready) {
    return (
      <SafeAreaProvider>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} />
          <Text style={{ color: colors.muted, marginTop: spacing.sm }}>Preparando datos locales</Text>
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SecurityGate>
        <StatusBar barStyle="default" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.surface },
            headerTintColor: colors.text,
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="dashboard" options={{ title: 'Capital Tracker MB' }} />
          <Stack.Screen name="accounts/index" options={{ title: 'Cuentas' }} />
          <Stack.Screen name="accounts/new" options={{ title: 'Nueva cuenta' }} />
          <Stack.Screen name="accounts/[id]" options={{ title: 'Detalle de cuenta' }} />
          <Stack.Screen name="transactions/index" options={{ title: 'Movimientos' }} />
          <Stack.Screen name="transactions/new" options={{ title: 'Nuevo movimiento' }} />
          <Stack.Screen name="bets/index" options={{ title: 'Apuestas' }} />
          <Stack.Screen name="bets/new" options={{ title: 'Nueva apuesta' }} />
          <Stack.Screen name="matched-bets/index" options={{ title: 'Matched betting' }} />
          <Stack.Screen name="matched-bets/new" options={{ title: 'Nueva matched bet' }} />
          <Stack.Screen name="stats/index" options={{ title: 'Estadisticas' }} />
          <Stack.Screen name="import-export/index" options={{ title: 'Importar/exportar' }} />
          <Stack.Screen name="settings/index" options={{ title: 'Ajustes' }} />
          <Stack.Screen name="settings/audit-log" options={{ title: 'Historial de cambios' }} />
          <Stack.Screen name="settings/diagnostics" options={{ title: 'Diagnostico' }} />
        </Stack>
      </SecurityGate>
    </SafeAreaProvider>
  );
}
