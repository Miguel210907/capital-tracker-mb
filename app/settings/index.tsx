import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../src/components/AppButton';
import { AppCard } from '../../src/components/AppCard';
import { AppInput } from '../../src/components/AppInput';
import { Screen } from '../../src/components/Screen';
import { SectionTitle } from '../../src/components/SectionTitle';
import { useAccounts } from '../../src/hooks/useAccounts';
import {
  getResponsibleGamblingLimits,
  saveResponsibleGamblingLimits,
  type ResponsibleGamblingLimits,
} from '../../src/services/responsibleGamblingService';
import {
  disablePin,
  getSecuritySettings,
  setBiometricsEnabled,
  setPin,
  type SecuritySettings,
} from '../../src/services/securityService';
import { recalculateBalances } from '../../src/services/transactionService';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { toNumber } from '../../src/utils/money';

const EMPTY_LIMITS: ResponsibleGamblingLimits = {
  dailyStakeLimit: 0,
  weeklyStakeLimit: 0,
  monthlyStakeLimit: 0,
  monthlyLossLimit: 0,
  bookmakerStakeLimit: 0,
};

export default function SettingsScreen() {
  const router = useRouter();
  const { data: accounts } = useAccounts();
  const firstBookmaker = accounts?.find((account) => account.type === 'casa_apuestas');
  const [pin, setPinValue] = useState('');
  const [security, setSecurity] = useState<SecuritySettings | null>(null);
  const [limits, setLimits] = useState<ResponsibleGamblingLimits>(EMPTY_LIMITS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void reloadSettings();
  }, [firstBookmaker?.id]);

  async function reloadSettings() {
    const [securitySettings, nextLimits] = await Promise.all([
      getSecuritySettings(),
      getResponsibleGamblingLimits(firstBookmaker?.id),
    ]);
    setSecurity(securitySettings);
    setLimits(nextLimits);
  }

  async function handleRecalculate() {
    try {
      await recalculateBalances();
      Alert.alert('Saldos recalculados', 'Los saldos se han reconstruido desde movimientos.');
    } catch (unknownError) {
      Alert.alert('No se pudo recalcular', unknownError instanceof Error ? unknownError.message : 'Error desconocido.');
    }
  }

  async function handleSetPin() {
    try {
      await setPin(pin);
      setPinValue('');
      await reloadSettings();
      Alert.alert('PIN activado', 'La app pedira PIN al abrirse.');
    } catch (unknownError) {
      Alert.alert('No se pudo activar PIN', unknownError instanceof Error ? unknownError.message : 'Error desconocido.');
    }
  }

  async function handleDisablePin() {
    Alert.alert('Desactivar PIN', 'La app dejara de pedir autenticacion local.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Desactivar',
        style: 'destructive',
        onPress: async () => {
          await disablePin();
          await reloadSettings();
        },
      },
    ]);
  }

  async function handleToggleBiometrics(enabled: boolean) {
    try {
      await setBiometricsEnabled(enabled);
      await reloadSettings();
    } catch (unknownError) {
      Alert.alert('No se pudo cambiar biometria', unknownError instanceof Error ? unknownError.message : 'Error desconocido.');
    }
  }

  async function handleSaveLimits() {
    setSaving(true);
    try {
      await saveResponsibleGamblingLimits(limits, firstBookmaker?.id);
      Alert.alert('Limites guardados', 'Los avisos se mostraran antes de guardar nuevas apuestas.');
    } catch (unknownError) {
      Alert.alert('No se pudieron guardar', unknownError instanceof Error ? unknownError.message : 'Error desconocido.');
    } finally {
      setSaving(false);
    }
  }

  function updateLimit(key: keyof ResponsibleGamblingLimits, value: string) {
    setLimits((current) => ({ ...current, [key]: toNumber(value) }));
  }

  return (
    <Screen>
      <SectionTitle>Ajustes</SectionTitle>

      <AppCard>
        <Text style={styles.title}>Datos locales</Text>
        <Text style={styles.text}>Todo se guarda en SQLite dentro del iPhone. No hay backend ni nube.</Text>
        <View style={styles.actions}>
          <AppButton title="Recalcular saldos" onPress={handleRecalculate} variant="secondary" />
          <AppButton title="Importar/exportar" onPress={() => router.push('/import-export')} variant="secondary" />
          <AppButton title="Historial de cambios" onPress={() => router.push('/settings/audit-log')} variant="secondary" />
          <AppButton title="Diagnostico" onPress={() => router.push('/settings/diagnostics')} variant="secondary" />
        </View>
      </AppCard>

      <AppCard>
        <Text style={styles.title}>Seguridad</Text>
        <Text style={styles.text}>
          PIN: {security?.pinEnabled ? 'activado' : 'desactivado'} | Biometria: {security?.biometricsEnabled ? 'activada' : 'desactivada'}
        </Text>
        <AppInput
          label="Nuevo PIN local"
          value={pin}
          onChangeText={setPinValue}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={8}
          placeholder="4-8 digitos"
        />
        <View style={styles.actions}>
          <AppButton title="Activar/cambiar PIN" onPress={handleSetPin} />
          <AppButton title="Desactivar PIN" onPress={handleDisablePin} variant="danger" />
          <AppButton
            title={security?.biometricsEnabled ? 'Desactivar Face ID/Touch ID' : 'Activar Face ID/Touch ID'}
            onPress={() => handleToggleBiometrics(!security?.biometricsEnabled)}
            variant="secondary"
          />
        </View>
        <Text style={styles.note}>
          Face ID no se puede probar en Expo Go; requiere build nativo. El PIN y los hashes se guardan en SecureStore.
        </Text>
      </AppCard>

      <AppCard>
        <Text style={styles.title}>Juego responsable</Text>
        <Text style={styles.text}>Esta app solo registra datos y no recomienda apostar.</Text>
        <AppInput
          label="Limite diario apostado"
          value={String(limits.dailyStakeLimit)}
          onChangeText={(value) => updateLimit('dailyStakeLimit', value)}
          keyboardType="decimal-pad"
        />
        <AppInput
          label="Limite semanal apostado"
          value={String(limits.weeklyStakeLimit)}
          onChangeText={(value) => updateLimit('weeklyStakeLimit', value)}
          keyboardType="decimal-pad"
        />
        <AppInput
          label="Limite mensual apostado"
          value={String(limits.monthlyStakeLimit)}
          onChangeText={(value) => updateLimit('monthlyStakeLimit', value)}
          keyboardType="decimal-pad"
        />
        <AppInput
          label="Limite mensual de perdidas"
          value={String(limits.monthlyLossLimit)}
          onChangeText={(value) => updateLimit('monthlyLossLimit', value)}
          keyboardType="decimal-pad"
        />
        <AppInput
          label={firstBookmaker ? `Limite mensual ${firstBookmaker.name}` : 'Limite por casa'}
          value={String(limits.bookmakerStakeLimit)}
          onChangeText={(value) => updateLimit('bookmakerStakeLimit', value)}
          keyboardType="decimal-pad"
        />
        <AppButton title="Guardar limites" onPress={handleSaveLimits} disabled={saving} />
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
  text: {
    color: colors.text,
    fontSize: 15,
  },
  note: {
    color: colors.muted,
    fontSize: 12,
  },
  actions: {
    gap: spacing.sm,
  },
});
