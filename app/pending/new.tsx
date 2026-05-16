import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Text } from 'react-native';

import { AppButton } from '../../src/components/AppButton';
import { AppInput } from '../../src/components/AppInput';
import { AppSelect } from '../../src/components/AppSelect';
import { Screen } from '../../src/components/Screen';
import { SectionTitle } from '../../src/components/SectionTitle';
import { PENDING_ITEM_STATUSES, PENDING_ITEM_TYPES } from '../../src/domain/constants';
import type { PendingItemStatus, PendingItemType } from '../../src/domain/types';
import { useAccounts } from '../../src/hooks/useAccounts';
import {
  createPendingItem,
  getPendingItemById,
  updatePendingItem,
} from '../../src/services/pendingService';
import { colors } from '../../src/theme/colors';
import { formatSpanishDate, parseSpanishDateInput, todaySpanishDate } from '../../src/utils/dates';
import { toNumber } from '../../src/utils/money';

export default function NewPendingItemScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const editingId = typeof params.id === 'string' ? params.id : '';
  const { data: accounts, loading: accountsLoading } = useAccounts();

  const [loading, setLoading] = useState(Boolean(editingId));
  const [title, setTitle] = useState('');
  const [type, setType] = useState<PendingItemType>('ingreso_previsto');
  const [status, setStatus] = useState<PendingItemStatus>('pendiente');
  const [createdDate, setCreatedDate] = useState(todaySpanishDate());
  const [expectedDate, setExpectedDate] = useState(todaySpanishDate());
  const [accountId, setAccountId] = useState('');
  const [investmentRequired, setInvestmentRequired] = useState('0');
  const [expectedIncome, setExpectedIncome] = useState('0');
  const [expectedExpense, setExpectedExpense] = useState('0');
  const [actualProfit, setActualProfit] = useState('0');
  const [priority, setPriority] = useState('2');
  const [recurrence, setRecurrence] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const accountOptions = useMemo(
    () => [
      { label: 'Sin cuenta', value: '' },
      ...(accounts ?? []).map((account) => ({ label: account.name, value: account.id })),
    ],
    [accounts],
  );

  useEffect(() => {
    if (!editingId) {
      return;
    }

    getPendingItemById(editingId)
      .then((item) => {
        if (!item) {
          Alert.alert('No encontrado', 'El pendiente ya no existe.');
          router.back();
          return;
        }

        setTitle(item.title);
        setType(item.type);
        setStatus(item.status);
        setCreatedDate(formatSpanishDate(item.created_date));
        setExpectedDate(item.expected_date ? formatSpanishDate(item.expected_date) : '');
        setAccountId(item.account_id ?? '');
        setInvestmentRequired(String(item.investment_required).replace('.', ','));
        setExpectedIncome(String(item.expected_income).replace('.', ','));
        setExpectedExpense(String(item.expected_expense).replace('.', ','));
        setActualProfit(String(item.actual_profit).replace('.', ','));
        setPriority(String(item.priority));
        setRecurrence(item.recurrence ?? '');
        setNotes(item.notes ?? '');
      })
      .catch((unknownError) => {
        Alert.alert(
          'No se pudo cargar',
          unknownError instanceof Error ? unknownError.message : 'Error desconocido.',
        );
      })
      .finally(() => setLoading(false));
  }, [editingId, router]);

  async function handleSave() {
    setSaving(true);
    try {
      const input = {
        title,
        type,
        status,
        createdDate: parseSpanishDateInput(createdDate),
        expectedDate: expectedDate.trim() ? parseSpanishDateInput(expectedDate) : null,
        accountId: accountId || null,
        investmentRequired: toNumber(investmentRequired),
        expectedIncome: toNumber(expectedIncome),
        expectedExpense: toNumber(expectedExpense),
        actualProfit: toNumber(actualProfit),
        priority: Math.max(1, Math.min(3, Math.round(toNumber(priority, 2)))),
        recurrence: recurrence || null,
        notes,
      };

      if (editingId) {
        await updatePendingItem({ id: editingId, ...input });
      } else {
        await createPendingItem(input);
      }

      router.replace('/(tabs)/pending');
    } catch (unknownError) {
      Alert.alert(
        'No se pudo guardar',
        unknownError instanceof Error ? unknownError.message : 'Error desconocido.',
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading || accountsLoading) {
    return (
      <Screen>
        <ActivityIndicator color={colors.primary} />
      </Screen>
    );
  }

  const expectedProfit = toNumber(expectedIncome) - toNumber(expectedExpense) - toNumber(investmentRequired);

  return (
    <Screen>
      <SectionTitle>{editingId ? 'Editar pendiente' : 'Nuevo pendiente'}</SectionTitle>
      <Text style={{ color: colors.muted }}>
        Controla cobros, ventas, suscripciones, bonus u oportunidades que todavia no estan cerradas.
      </Text>
      <AppInput label="Titulo" value={title} onChangeText={setTitle} placeholder="Venta iPhone, bono, suscripcion..." />
      <AppSelect
        label="Tipo"
        value={type}
        options={PENDING_ITEM_TYPES.map((itemType) => ({
          label: itemType.replace('_', ' '),
          value: itemType,
        }))}
        onChange={(value) => setType(value as PendingItemType)}
      />
      <AppSelect
        label="Estado"
        value={status}
        options={PENDING_ITEM_STATUSES.map((itemStatus) => ({
          label: itemStatus.replace('_', ' '),
          value: itemStatus,
        }))}
        onChange={(value) => setStatus(value as PendingItemStatus)}
      />
      <AppInput label="Fecha creada" value={createdDate} onChangeText={setCreatedDate} placeholder="16/05/2026" />
      <AppInput label="Fecha prevista" value={expectedDate} onChangeText={setExpectedDate} placeholder="20/05/2026" />
      <AppSelect label="Cuenta relacionada" value={accountId} options={accountOptions} onChange={setAccountId} />
      <AppInput
        label="Dinero a invertir"
        value={investmentRequired}
        onChangeText={setInvestmentRequired}
        keyboardType="decimal-pad"
      />
      <AppInput
        label="Dinero que conseguire"
        value={expectedIncome}
        onChangeText={setExpectedIncome}
        keyboardType="decimal-pad"
      />
      <AppInput
        label="Dinero que perdere/pagare"
        value={expectedExpense}
        onChangeText={setExpectedExpense}
        keyboardType="decimal-pad"
      />
      <Text style={{ color: expectedProfit >= 0 ? colors.success : colors.danger, fontWeight: '800' }}>
        Beneficio previsto: {String(Math.round(expectedProfit * 100) / 100).replace('.', ',')} EUR
      </Text>
      <AppInput
        label="Beneficio real si ya se conoce"
        value={actualProfit}
        onChangeText={setActualProfit}
        keyboardType="decimal-pad"
      />
      <AppInput label="Prioridad 1-3" value={priority} onChangeText={setPriority} keyboardType="number-pad" />
      <AppInput label="Recurrencia" value={recurrence} onChangeText={setRecurrence} placeholder="mensual, unica..." />
      <AppInput label="Notas" value={notes} onChangeText={setNotes} multiline />
      <AppButton title={editingId ? 'Guardar cambios' : 'Crear pendiente'} onPress={handleSave} disabled={saving} />
    </Screen>
  );
}
