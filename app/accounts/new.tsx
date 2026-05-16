import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { AppButton } from '../../src/components/AppButton';
import { AppInput } from '../../src/components/AppInput';
import { AppSelect } from '../../src/components/AppSelect';
import { Screen } from '../../src/components/Screen';
import { SectionTitle } from '../../src/components/SectionTitle';
import { ACCOUNT_TYPES } from '../../src/domain/constants';
import type { AccountType } from '../../src/domain/types';
import { createAccount } from '../../src/services/accountService';
import { toNumber } from '../../src/utils/money';

export default function NewAccountScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('banco');
  const [initialBalance, setInitialBalance] = useState('0');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await createAccount({
        name,
        type,
        initialBalance: toNumber(initialBalance),
        notes,
      });
      router.replace('/accounts');
    } catch (error) {
      Alert.alert('No se pudo guardar', error instanceof Error ? error.message : 'Error desconocido.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <SectionTitle>Nueva cuenta</SectionTitle>
      <AppInput label="Nombre" value={name} onChangeText={setName} placeholder="Banco, efectivo, casa..." />
      <AppSelect
        label="Tipo"
        value={type}
        options={ACCOUNT_TYPES.map((accountType) => ({
          label: accountType.replace('_', ' '),
          value: accountType,
        }))}
        onChange={(value) => setType(value as AccountType)}
      />
      <AppInput
        label="Saldo inicial"
        value={initialBalance}
        onChangeText={setInitialBalance}
        keyboardType="decimal-pad"
        placeholder="0,00"
      />
      <AppInput label="Notas" value={notes} onChangeText={setNotes} multiline />
      <AppButton title="Guardar cuenta" onPress={handleSave} disabled={saving} />
    </Screen>
  );
}
