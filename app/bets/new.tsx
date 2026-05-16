import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Text } from 'react-native';

import { AppButton } from '../../src/components/AppButton';
import { AppInput } from '../../src/components/AppInput';
import { AppSelect } from '../../src/components/AppSelect';
import { EmptyState } from '../../src/components/EmptyState';
import { Screen } from '../../src/components/Screen';
import { SectionTitle } from '../../src/components/SectionTitle';
import { useAccounts } from '../../src/hooks/useAccounts';
import { checkStakeLimits } from '../../src/services/responsibleGamblingService';
import { createBet } from '../../src/services/bettingService';
import { colors } from '../../src/theme/colors';
import { parseSpanishDateInput, todaySpanishDate } from '../../src/utils/dates';
import { toNumber } from '../../src/utils/money';

export default function NewBetScreen() {
  const router = useRouter();
  const { data: accounts, loading } = useAccounts();
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

  async function handleSave(skipLimitWarning = false) {
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
      router.replace('/bets');
    } catch (unknownError) {
      Alert.alert('No se pudo guardar', unknownError instanceof Error ? unknownError.message : 'Error desconocido.');
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
        <EmptyState title="Primero crea una cuenta" body="Necesitas una cuenta de casa de apuestas." />
        <AppButton title="Crear cuenta" onPress={() => router.push('/accounts/new')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <SectionTitle>Nueva apuesta</SectionTitle>
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
      <AppButton title="Guardar apuesta pendiente" onPress={() => void handleSave()} disabled={saving} />
    </Screen>
  );
}
