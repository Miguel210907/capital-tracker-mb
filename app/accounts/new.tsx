import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert } from 'react-native';

import { AppButton } from '../../src/components/AppButton';
import { AppInput } from '../../src/components/AppInput';
import { AppSelect } from '../../src/components/AppSelect';
import { Screen } from '../../src/components/Screen';
import { SectionTitle } from '../../src/components/SectionTitle';
import { ACCOUNT_TYPES } from '../../src/domain/constants';
import type { AccountType } from '../../src/domain/types';
import { createAccount, getAccountById, updateAccount } from '../../src/services/accountService';
import { colors } from '../../src/theme/colors';
import { toNumber } from '../../src/utils/money';

export default function NewAccountScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const editingId = typeof params.id === 'string' ? params.id : '';
  const [loading, setLoading] = useState(Boolean(editingId));
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('banco');
  const [initialBalance, setInitialBalance] = useState('0');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editingId) {
      return;
    }

    getAccountById(editingId)
      .then((account) => {
        if (!account) {
          Alert.alert('No encontrada', 'La cuenta ya no existe.');
          router.back();
          return;
        }

        setName(account.name);
        setType(account.type);
        setInitialBalance(String(account.initial_balance).replace('.', ','));
        setNotes(account.notes ?? '');
      })
      .catch((error) => {
        Alert.alert('No se pudo cargar', error instanceof Error ? error.message : 'Error desconocido.');
      })
      .finally(() => setLoading(false));
  }, [editingId, router]);

  async function handleSave() {
    setSaving(true);
    try {
      if (editingId) {
        await updateAccount({ id: editingId, name, type, notes });
      } else {
        await createAccount({
          name,
          type,
          initialBalance: toNumber(initialBalance),
          notes,
        });
      }
      router.replace('/accounts');
    } catch (error) {
      Alert.alert('No se pudo guardar', error instanceof Error ? error.message : 'Error desconocido.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Screen>
        <ActivityIndicator color={colors.primary} />
      </Screen>
    );
  }

  return (
    <Screen>
      <SectionTitle>{editingId ? 'Editar cuenta' : 'Nueva cuenta'}</SectionTitle>
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
      {!editingId ? (
        <AppInput
          label="Saldo inicial"
          value={initialBalance}
          onChangeText={setInitialBalance}
          keyboardType="decimal-pad"
          placeholder="0,00"
        />
      ) : null}
      <AppInput label="Notas" value={notes} onChangeText={setNotes} multiline />
      <AppButton title={editingId ? 'Guardar cambios' : 'Guardar cuenta'} onPress={handleSave} disabled={saving} />
    </Screen>
  );
}
