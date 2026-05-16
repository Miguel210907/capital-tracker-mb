import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Text } from 'react-native';

import { AppButton } from '../../src/components/AppButton';
import { AppInput } from '../../src/components/AppInput';
import { AppSelect } from '../../src/components/AppSelect';
import { EmptyState } from '../../src/components/EmptyState';
import { Screen } from '../../src/components/Screen';
import { SectionTitle } from '../../src/components/SectionTitle';
import { useAccounts } from '../../src/hooks/useAccounts';
import { checkStakeLimits } from '../../src/services/responsibleGamblingService';
import { createBet, getBetById, updateBet } from '../../src/services/bettingService';
import { colors } from '../../src/theme/colors';
import { parseSpanishDateInput, todaySpanishDate } from '../../src/utils/dates';
import { toNumber } from '../../src/utils/money';

export default function NewBetScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const editingId = typeof params.id === 'string' ? params.id : '';
  const { data: accounts, loading } = useAccounts();
  const [loadingRecord, setLoadingRecord] = useState(Boolean(editingId));
  const [editingStatus, setEditingStatus] = useState('pendiente');
  const [date, setDate] = useState(todaySpanishDate());
  const [event, setEvent] = useState('');
  const [sport, setSport] = useState('');
  const [competition, setCompetition] = useState('');
  const [market, setMarket] = useState('');
  const [betDescription, setBetDescription] = useState('');
  const [odds, setOdds] = useState('');
  const [stake, setStake] = useState('');
  const [source, setSource] = useState('');
  const [bookmakerAccountId, setBookmakerAccountId] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const accountOptions = useMemo(() => {
    const bookmakerAccounts = (accounts ?? []).filter(
      (account) => account.type === 'casa_apuestas',
    );
    const usableAccounts = bookmakerAccounts.length ? bookmakerAccounts : accounts ?? [];
    return usableAccounts.map((account) => ({ label: account.name, value: account.id }));
  }, [accounts]);

  useEffect(() => {
    if (!editingId) {
      return;
    }

    getBetById(editingId)
      .then((bet) => {
        if (!bet) {
          Alert.alert('No encontrada', 'La apuesta ya no existe.');
          router.back();
          return;
        }

        setDate(formatForInput(bet.date));
        setEvent(bet.event);
        setSport(bet.sport ?? '');
        setCompetition(bet.competition ?? '');
        setMarket(bet.market ?? '');
        setBetDescription(bet.bet_description);
        setOdds(String(bet.odds).replace('.', ','));
        setStake(String(bet.stake).replace('.', ','));
        setSource(bet.source ?? '');
        setBookmakerAccountId(bet.bookmaker_account_id);
        setNotes(bet.notes ?? '');
        setEditingStatus(bet.status);
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
      const dbDate = parseSpanishDateInput(date);
      const parsedStake = toNumber(stake);
      const selectedBookmakerAccountId = bookmakerAccountId || accountOptions[0]?.value || '';

      if (!skipLimitWarning) {
        const warnings = await checkStakeLimits({
          date: dbDate,
          stake: parsedStake,
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
            'Recalcular apuesta liquidada',
            'La apuesta ya esta liquidada. Si continuas se recalcularan los movimientos asociados con los nuevos datos.',
            [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Recalcular', onPress: () => void handleSave(true, true) },
            ],
          );
          return;
        }

        await updateBet({
          id: editingId,
          date: dbDate,
          event,
          sport,
          competition,
          market,
          betDescription,
          odds: toNumber(odds),
          stake: parsedStake,
          source,
          bookmakerAccountId: selectedBookmakerAccountId,
          notes,
          allowSettledEdit,
        });
      } else {
        await createBet({
          date: dbDate,
          event,
          sport,
          competition,
          market,
          betDescription,
          odds: toNumber(odds),
          stake: parsedStake,
          source,
          bookmakerAccountId: selectedBookmakerAccountId,
          notes,
        });
      }
      router.replace('/(tabs)/bets');
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

  if (!accounts?.length) {
    return (
      <Screen>
        <EmptyState title="Primero crea una cuenta" body="Necesitas una cuenta de casa de apuestas." />
        <AppButton title="Crear cuenta" onPress={() => router.push('/accounts/new')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <SectionTitle>{editingId ? 'Editar apuesta' : 'Nueva apuesta'}</SectionTitle>
      <Text style={{ color: colors.muted }}>Al guardar, el stake queda bloqueado como movimiento negativo.</Text>
      <AppInput label="Fecha" value={date} onChangeText={setDate} placeholder="16/05/2026" />
      <AppInput label="Partido/evento" value={event} onChangeText={setEvent} />
      <AppInput label="Deporte" value={sport} onChangeText={setSport} />
      <AppInput label="Competicion" value={competition} onChangeText={setCompetition} />
      <AppInput label="Mercado" value={market} onChangeText={setMarket} />
      <AppInput label="Apuesta" value={betDescription} onChangeText={setBetDescription} />
      <AppInput label="Cuota" value={odds} onChangeText={setOdds} keyboardType="decimal-pad" />
      <AppInput label="Dinero apostado" value={stake} onChangeText={setStake} keyboardType="decimal-pad" />
      <AppInput label="Origen" value={source} onChangeText={setSource} placeholder="Tipster, propia, promo..." />
      <AppSelect
        label="Casa de apuestas"
        value={bookmakerAccountId || accountOptions[0]?.value || ''}
        options={accountOptions}
        onChange={setBookmakerAccountId}
      />
      <AppInput label="Nota" value={notes} onChangeText={setNotes} multiline />
      <AppButton title={editingId ? 'Guardar cambios' : 'Guardar apuesta pendiente'} onPress={() => void handleSave()} disabled={saving} />
    </Screen>
  );
}

function formatForInput(dbDate: string): string {
  const [year, month, day] = dbDate.split('-');
  return `${day}/${month}/${year}`;
}
