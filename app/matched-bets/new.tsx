import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Text } from 'react-native';

import { AppButton } from '../../src/components/AppButton';
import { AppInput } from '../../src/components/AppInput';
import { AppSelect } from '../../src/components/AppSelect';
import { EmptyState } from '../../src/components/EmptyState';
import { Screen } from '../../src/components/Screen';
import { SectionTitle } from '../../src/components/SectionTitle';
import { MATCHED_OFFER_TYPES } from '../../src/domain/constants';
import type { MatchedOfferType } from '../../src/domain/types';
import { useAccounts } from '../../src/hooks/useAccounts';
import {
  createMatchedBet,
  getMatchedBetById,
  updateMatchedBet,
} from '../../src/services/matchedBettingService';
import { checkStakeLimits } from '../../src/services/responsibleGamblingService';
import { colors } from '../../src/theme/colors';
import { parseSpanishDateInput, todaySpanishDate } from '../../src/utils/dates';
import { toNumber } from '../../src/utils/money';

export default function NewMatchedBetScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const editingId = typeof params.id === 'string' ? params.id : '';
  const { data: accounts, loading } = useAccounts();
  const [loadingRecord, setLoadingRecord] = useState(Boolean(editingId));
  const [editingStatus, setEditingStatus] = useState('pendiente');
  const [date, setDate] = useState(todaySpanishDate());
  const [event, setEvent] = useState('');
  const [sport, setSport] = useState('');
  const [bookmakerAccountId, setBookmakerAccountId] = useState('');
  const [exchangeAccountId, setExchangeAccountId] = useState('');
  const [source, setSource] = useState('');
  const [offerType, setOfferType] = useState<MatchedOfferType>('qualifying_bet');
  const [backSelection, setBackSelection] = useState('');
  const [backOdds, setBackOdds] = useState('');
  const [backStake, setBackStake] = useState('');
  const [layOdds, setLayOdds] = useState('');
  const [layStake, setLayStake] = useState('');
  const [layCommission, setLayCommission] = useState('2');
  const [freebetAmount, setFreebetAmount] = useState('0');
  const [createPending, setCreatePending] = useState('no');
  const [pendingExpectedDate, setPendingExpectedDate] = useState(todaySpanishDate());
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const bookmakerOptions = useMemo(() => {
    const filtered = (accounts ?? []).filter((account) => account.type === 'casa_apuestas');
    const usable = filtered.length ? filtered : accounts ?? [];
    return usable.map((account) => ({ label: account.name, value: account.id }));
  }, [accounts]);

  const exchangeOptions = useMemo(() => {
    const filtered = (accounts ?? []).filter((account) => account.type === 'exchange');
    const usable = filtered.length ? filtered : accounts ?? [];
    return usable.map((account) => ({ label: account.name, value: account.id }));
  }, [accounts]);

  useEffect(() => {
    if (!editingId) {
      return;
    }

    getMatchedBetById(editingId)
      .then((matchedBet) => {
        if (!matchedBet) {
          Alert.alert('No encontrada', 'La matched bet ya no existe.');
          router.back();
          return;
        }

        setDate(formatForInput(matchedBet.date));
        setEvent(matchedBet.event);
        setSport(matchedBet.sport ?? '');
        setBookmakerAccountId(matchedBet.bookmaker_account_id);
        setExchangeAccountId(matchedBet.exchange_account_id);
        setSource(matchedBet.source ?? '');
        setOfferType(matchedBet.offer_type);
        setBackSelection(matchedBet.back_selection ?? '');
        setBackOdds(String(matchedBet.back_odds).replace('.', ','));
        setBackStake(String(matchedBet.back_stake).replace('.', ','));
        setLayOdds(String(matchedBet.lay_odds).replace('.', ','));
        setLayStake(String(matchedBet.lay_stake).replace('.', ','));
        setLayCommission(String(matchedBet.lay_commission).replace('.', ','));
        setFreebetAmount(String(matchedBet.freebet_amount).replace('.', ','));
        setNotes(matchedBet.notes ?? '');
        setEditingStatus(matchedBet.status);
      })
      .catch((unknownError) => {
        Alert.alert(
          'No se pudo cargar',
          unknownError instanceof Error ? unknownError.message : 'Error desconocido.',
        );
      })
      .finally(() => setLoadingRecord(false));
  }, [editingId, router]);

  async function handleSave(skipLimitWarning = false, allowSettledEdit = false) {
    setSaving(true);
    try {
      const selectedBookmakerAccountId = bookmakerAccountId || bookmakerOptions[0]?.value || '';
      const selectedExchangeAccountId =
        exchangeAccountId ||
        exchangeOptions.find((option) => option.value !== selectedBookmakerAccountId)?.value ||
        exchangeOptions[0]?.value ||
        '';
      const dbDate = parseSpanishDateInput(date);
      const parsedBackStake = toNumber(backStake);

      if (!skipLimitWarning) {
        const warnings = await checkStakeLimits({
          date: dbDate,
          stake: parsedBackStake,
          bookmakerAccountId: selectedBookmakerAccountId,
        });

        if (warnings.length > 0) {
          setSaving(false);
          Alert.alert(
            'Aviso de limite',
            `${warnings.map((warning) => warning.message).join('\n')}\n\nEsta app solo registra datos y no recomienda apostar.`,
            [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Guardar igualmente', onPress: () => void handleSave(true) },
            ],
          );
          return;
        }
      }

      if (editingId) {
        if (editingStatus !== 'pendiente' && !allowSettledEdit) {
          setSaving(false);
          Alert.alert(
            'Recalcular matched bet liquidada',
            'La matched bet ya esta liquidada. Si continuas se recalcularan responsabilidad, beneficio y movimientos asociados.',
            [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Recalcular', onPress: () => void handleSave(true, true) },
            ],
          );
          return;
        }

        await updateMatchedBet({
          id: editingId,
          date: dbDate,
          event,
          sport,
          bookmakerAccountId: selectedBookmakerAccountId,
          exchangeAccountId: selectedExchangeAccountId,
          source,
          offerType,
          backSelection,
          backOdds: toNumber(backOdds),
          backStake: parsedBackStake,
          layOdds: toNumber(layOdds),
          layStake: toNumber(layStake),
          layCommission: toNumber(layCommission),
          freebetAmount: toNumber(freebetAmount),
          notes,
          allowSettledEdit,
        });
      } else {
        await createMatchedBet({
          date: dbDate,
          event,
          sport,
          bookmakerAccountId: selectedBookmakerAccountId,
          exchangeAccountId: selectedExchangeAccountId,
          source,
          offerType,
          backSelection,
          backOdds: toNumber(backOdds),
          backStake: parsedBackStake,
          layOdds: toNumber(layOdds),
          layStake: toNumber(layStake),
          layCommission: toNumber(layCommission),
          freebetAmount: toNumber(freebetAmount),
          notes,
          createPendingItem: createPending === 'si',
          pendingExpectedDate:
            createPending === 'si' ? parseSpanishDateInput(pendingExpectedDate) : null,
        });
      }
      router.replace('/matched-bets');
    } catch (unknownError) {
      Alert.alert('No se pudo guardar', unknownError instanceof Error ? unknownError.message : 'Error desconocido.');
    } finally {
      setSaving(false);
    }
  }

  if (loading || loadingRecord) {
    return (
      <Screen>
        <ActivityIndicator color={colors.primary} />
      </Screen>
    );
  }

  if (!accounts || accounts.length < 2) {
    return (
      <Screen>
        <EmptyState title="Crea al menos dos cuentas" body="Necesitas una casa de apuestas y un exchange." />
        <AppButton title="Crear cuenta" onPress={() => router.push('/accounts/new')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <SectionTitle>{editingId ? 'Editar matched bet' : 'Nueva matched bet'}</SectionTitle>
      <Text style={{ color: colors.muted }}>Se calculara responsabilidad lay, beneficio esperado y ROI.</Text>
      <AppInput label="Fecha" value={date} onChangeText={setDate} placeholder="16/05/2026" />
      <AppInput label="Partido/evento" value={event} onChangeText={setEvent} />
      <AppInput label="Deporte" value={sport} onChangeText={setSport} />
      <AppSelect
        label="Casa de apuestas"
        value={bookmakerAccountId || bookmakerOptions[0]?.value || ''}
        options={bookmakerOptions}
        onChange={setBookmakerAccountId}
      />
      <AppSelect
        label="Exchange"
        value={exchangeAccountId || exchangeOptions[0]?.value || ''}
        options={exchangeOptions}
        onChange={setExchangeAccountId}
      />
      <AppInput label="Origen/oferta" value={source} onChangeText={setSource} />
      <AppSelect
        label="Tipo de oferta"
        value={offerType}
        options={MATCHED_OFFER_TYPES.map((type) => ({ label: type.replace('_', ' '), value: type }))}
        onChange={(value) => setOfferType(value as MatchedOfferType)}
      />
      <AppInput label="Seleccion back" value={backSelection} onChangeText={setBackSelection} />
      <AppInput label="Cuota back" value={backOdds} onChangeText={setBackOdds} keyboardType="decimal-pad" />
      <AppInput label="Stake back" value={backStake} onChangeText={setBackStake} keyboardType="decimal-pad" />
      <AppInput label="Cuota lay" value={layOdds} onChangeText={setLayOdds} keyboardType="decimal-pad" />
      <AppInput label="Stake lay" value={layStake} onChangeText={setLayStake} keyboardType="decimal-pad" />
      <AppInput label="Comision exchange %" value={layCommission} onChangeText={setLayCommission} keyboardType="decimal-pad" />
      <AppInput label="Freebet" value={freebetAmount} onChangeText={setFreebetAmount} keyboardType="decimal-pad" />
      {!editingId ? (
        <>
          <AppSelect
            label="Crear pendiente vinculado"
            value={createPending}
            options={[
              { label: 'No', value: 'no' },
              { label: 'Si', value: 'si' },
            ]}
            onChange={setCreatePending}
          />
          {createPending === 'si' ? (
            <AppInput
              label="Fecha prevista del pendiente"
              value={pendingExpectedDate}
              onChangeText={setPendingExpectedDate}
              placeholder="20/05/2026"
            />
          ) : null}
        </>
      ) : null}
      <AppInput label="Nota" value={notes} onChangeText={setNotes} multiline />
      <AppButton title={editingId ? 'Guardar cambios' : 'Guardar matched bet pendiente'} onPress={() => void handleSave()} disabled={saving} />
    </Screen>
  );
}

function formatForInput(dbDate: string): string {
  const [year, month, day] = dbDate.split('-');
  return `${day}/${month}/${year}`;
}
