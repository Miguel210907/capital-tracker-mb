import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

import { createId } from '../utils/ids';

const PIN_HASH_KEY = 'capital_tracker_mb.pin_hash';
const PIN_SALT_KEY = 'capital_tracker_mb.pin_salt';
const BIOMETRICS_ENABLED_KEY = 'capital_tracker_mb.biometrics_enabled';

export interface SecuritySettings {
  pinEnabled: boolean;
  biometricsEnabled: boolean;
  biometricsAvailable: boolean;
  biometricsEnrolled: boolean;
}

export async function getSecuritySettings(): Promise<SecuritySettings> {
  const [pinHash, biometricsEnabledValue, biometricsAvailable, biometricsEnrolled] =
    await Promise.all([
      SecureStore.getItemAsync(PIN_HASH_KEY),
      SecureStore.getItemAsync(BIOMETRICS_ENABLED_KEY),
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]);

  return {
    pinEnabled: !!pinHash,
    biometricsEnabled: biometricsEnabledValue === 'true',
    biometricsAvailable,
    biometricsEnrolled,
  };
}

export async function setPin(pin: string): Promise<void> {
  validatePin(pin);
  const salt = createId('salt');
  const hash = await hashPin(pin, salt);
  await SecureStore.setItemAsync(PIN_SALT_KEY, salt);
  await SecureStore.setItemAsync(PIN_HASH_KEY, hash);
}

export async function verifyPin(pin: string): Promise<boolean> {
  const [salt, storedHash] = await Promise.all([
    SecureStore.getItemAsync(PIN_SALT_KEY),
    SecureStore.getItemAsync(PIN_HASH_KEY),
  ]);

  if (!salt || !storedHash) {
    return false;
  }

  const candidate = await hashPin(pin, salt);
  return candidate === storedHash;
}

export async function disablePin(): Promise<void> {
  await SecureStore.deleteItemAsync(PIN_HASH_KEY);
  await SecureStore.deleteItemAsync(PIN_SALT_KEY);
  await setBiometricsEnabled(false);
}

export async function setBiometricsEnabled(enabled: boolean): Promise<void> {
  if (enabled) {
    const settings = await getSecuritySettings();
    if (!settings.pinEnabled) {
      throw new Error('Activa primero un PIN local.');
    }
    if (!settings.biometricsAvailable || !settings.biometricsEnrolled) {
      throw new Error('Face ID/Touch ID no esta disponible o no esta configurado en este iPhone.');
    }
  }

  await SecureStore.setItemAsync(BIOMETRICS_ENABLED_KEY, enabled ? 'true' : 'false');
}

export async function authenticateWithBiometrics(): Promise<boolean> {
  const settings = await getSecuritySettings();
  if (!settings.biometricsEnabled || !settings.biometricsAvailable || !settings.biometricsEnrolled) {
    return false;
  }

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Desbloquear Capital Tracker MB',
    fallbackLabel: 'Usar PIN',
    cancelLabel: 'Cancelar',
  });

  return result.success;
}

export async function isAuthenticationRequired(): Promise<boolean> {
  const settings = await getSecuritySettings();
  return settings.pinEnabled;
}

async function hashPin(pin: string, salt: string): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${salt}:${pin}`,
  );
}

function validatePin(pin: string): void {
  if (!/^\d{4,8}$/.test(pin)) {
    throw new Error('El PIN debe tener entre 4 y 8 digitos.');
  }
}
