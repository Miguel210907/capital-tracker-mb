import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import {
  authenticateWithBiometrics,
  getSecuritySettings,
  verifyPin,
} from '../services/securityService';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { AppButton } from './AppButton';
import { AppInput } from './AppInput';

interface SecurityGateProps {
  children: ReactNode;
}

export function SecurityGate({ children }: SecurityGateProps) {
  const [checking, setChecking] = useState(true);
  const [locked, setLocked] = useState(false);
  const [pin, setPin] = useState('');

  useEffect(() => {
    let active = true;

    async function checkSecurity() {
      const settings = await getSecuritySettings();
      if (!active) {
        return;
      }

      if (!settings.pinEnabled) {
        setLocked(false);
        setChecking(false);
        return;
      }

      if (settings.biometricsEnabled) {
        const success = await authenticateWithBiometrics();
        if (!active) {
          return;
        }

        if (success) {
          setLocked(false);
          setChecking(false);
          return;
        }
      }

      setLocked(true);
      setChecking(false);
    }

    checkSecurity().catch(() => {
      if (active) {
        setLocked(true);
        setChecking(false);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  async function handleUnlock() {
    const success = await verifyPin(pin);
    if (!success) {
      Alert.alert('PIN incorrecto', 'Comprueba el PIN e intentalo de nuevo.');
      return;
    }
    setLocked(false);
  }

  async function handleBiometrics() {
    const success = await authenticateWithBiometrics();
    if (!success) {
      Alert.alert('No desbloqueado', 'No se pudo autenticar con biometria.');
      return;
    }
    setLocked(false);
  }

  if (checking) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Comprobando seguridad</Text>
      </View>
    );
  }

  if (locked) {
    return (
      <View style={styles.locked}>
        <Text style={styles.title}>Capital Tracker MB</Text>
        <Text style={styles.body}>Introduce tu PIN local para desbloquear la app.</Text>
        <AppInput
          label="PIN"
          value={pin}
          onChangeText={setPin}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={8}
        />
        <AppButton title="Desbloquear" onPress={handleUnlock} />
        <AppButton title="Usar Face ID/Touch ID" onPress={handleBiometrics} variant="secondary" />
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  locked: {
    backgroundColor: colors.background,
    flex: 1,
    gap: spacing.md,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
  },
  body: {
    color: colors.muted,
    fontSize: 15,
  },
});
