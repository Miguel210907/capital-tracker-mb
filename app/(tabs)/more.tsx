import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../src/components/AppButton';
import { AppCard } from '../../src/components/AppCard';
import { Screen } from '../../src/components/Screen';
import { SectionTitle } from '../../src/components/SectionTitle';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';

export default function MoreScreen() {
  const router = useRouter();

  return (
    <Screen>
      <SectionTitle>Mas</SectionTitle>
      <AppCard>
        <Text style={styles.title}>Gestion</Text>
        <View style={styles.actions}>
          <AppButton title="Cuentas" onPress={() => router.push('/accounts')} variant="secondary" />
          <AppButton title="Matched betting" onPress={() => router.push('/matched-bets')} variant="secondary" />
          <AppButton title="Estadisticas" onPress={() => router.push('/stats')} variant="secondary" />
        </View>
      </AppCard>
      <AppCard>
        <Text style={styles.title}>Datos y seguridad</Text>
        <View style={styles.actions}>
          <AppButton title="Importar/exportar" onPress={() => router.push('/import-export')} variant="secondary" />
          <AppButton title="Ajustes" onPress={() => router.push('/settings')} variant="secondary" />
          <AppButton title="Diagnostico" onPress={() => router.push('/settings/diagnostics')} variant="secondary" />
          <AppButton title="Historial de cambios" onPress={() => router.push('/settings/audit-log')} variant="secondary" />
        </View>
      </AppCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  actions: {
    gap: spacing.sm,
  },
});
