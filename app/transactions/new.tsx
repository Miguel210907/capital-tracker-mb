import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Text } from 'react-native';

import { AppButton } from '../../src/components/AppButton';
import { AppInput } from '../../src/components/AppInput';
import { AppSelect } from '../../src/components/AppSelect';
import { EmptyState } from '../../src/components/EmptyState';
import { Screen } from '../../src/components/Screen';
import { SectionTitle } from '../../src/components/SectionTitle';
import { useAccounts } from '../../src/hooks/useAccounts';
import {
  createExpense,
  createIncome,
  createTransaction,
  createTransfer,
} from '../../src/services/transactionService';
import { colors } from '../../src/theme/colors';
import { parseSpanishDateInput, todaySpanishDate } from '../../src/utils/dates';
import { toNumber } from '../../src/utils/money';

type MovementMode = 'ingreso' | 'gasto' | 'transferencia' | 'ajuste';

function normalizeMode(value: string | undefined): MovementMode {
  if (value === 'ingreso' || value === 'gasto' || value === 'transferencia' || value === 'ajuste') {
    return value;
  }
  return 'gasto';
}

export default function NewTransactionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string; accountId?: string }>();
  const { data: accounts, loading } = useAccounts();
  const [mode, setMode] = useState<MovementMode>(normalizeMode(params.type));
  const [date, setDate] = useState(todaySpanishDate());
  const [accountId, setAccountId] = useState(params.accountId ?? '');
  const [toAccountId, setToAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const accountOptions = useMemo(
    () =>
      (accounts ?? []).map((account) => ({
        label: account.name,
        value: account.id,
      })),
    [accounts],
  );

  async function handleSave() {
    setSaving(true);
    try {
      const dbDate = parseSpanishDateInput(date);
      const parsedAmount = toNumber(amount);
      const selectedAccountId = accountId || accountOptions[0]?.value || '';
      const selectedToAccountId =
        toAccountId ||
        accountOptions.find((account) => account.value !== selectedAccountId)?.value ||
        '';

      if (mode === 'ingreso') {
        await createIncome({
          date: dbDate,
          accountId: selectedAccountId,
          amount: parsedAmount,
          category,
          description,
          notes,
        });
      } else if (mode === 'gasto') {
        await createExpense({
          date: dbDate,
          accountId: selectedAccountId,
          amount: parsedAmount,
          category,
          description,
          notes,
        });
      } else if (mode === 'transferencia') {
        await createTransfer({
          date: dbDate,
          fromAccountId: selectedAccountId,
          toAccountId: selectedToAccountId,
          amount: parsedAmount,
          notes,
        });
      } else {
        await createTransaction({
          date: dbDate,
          accountId: selectedAccountId,
          type: 'ajuste',
          amount: parsedAmount,
          category: 'ajuste',
          description: description || 'Ajuste manual',
          notes,
        });
      }

      router.replace('/transactions');
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

  if (!accounts?.length) {
    return (
      <Screen>
        <EmptyState title="Primero crea una cuenta" body="Los movimientos necesitan una cuenta asociada." />
        <AppButton title="Crear cuenta" onPress={() => router.push('/accounts/new')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <SectionTitle>Nuevo movimiento</SectionTitle>
      <Text style={{ color: colors.muted }}>Importes con coma o punto. Fecha en formato dd/mm/yyyy.</Text>
      <AppSelect
        label="Tipo"
        value={mode}
        options={[
          { label: 'Ingreso', value: 'ingreso' },
          { label: 'Gasto', value: 'gasto' },
          { label: 'Transferencia', value: 'transferencia' },
          { label: 'Ajuste', value: 'ajuste' },
        ]}
        onChange={(value) => setMode(value as MovementMode)}
      />
      <AppInput label="Fecha" value={date} onChangeText={setDate} placeholder="16/05/2026" />
      <AppSelect
        label={mode === 'transferencia' ? 'Cuenta origen' : 'Cuenta'}
        value={accountId || accountOptions[0]?.value || ''}
        options={accountOptions}
        onChange={setAccountId}
      />
      {mode === 'transferencia' ? (
        <AppSelect
          label="Cuenta destino"
          value={toAccountId || accountOptions.find((account) => account.value !== accountId)?.value || ''}
          options={accountOptions}
          onChange={setToAccountId}
        />
      ) : null}
      <AppInput
        label="Importe"
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        placeholder="0,00"
      />
      {mode !== 'transferencia' ? (
        <AppInput label="Categoria" value={category} onChangeText={setCategory} />
      ) : null}
      <AppInput label="Descripcion" value={description} onChangeText={setDescription} />
      <AppInput label="Notas" value={notes} onChangeText={setNotes} multiline />
      <AppButton title="Guardar movimiento" onPress={handleSave} disabled={saving} />
    </Screen>
  );
}
