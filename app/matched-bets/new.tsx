import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
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
import { createMatchedBet } from '../../src/services/matchedBettingService';
import { checkStakeLimits } from '../../src/services/responsibleGamblingService';
import { colors } from '../../src/theme/colors';
import { parseSpanishDateInput, todaySpanishDate } from '../../src/utils/dates';
import { toNumber } from '../../src/utils/money';

export default function NewMatchedBetScreen() {
  const router = useRouter();
  const { data: accounts, loading } = useAccounts();
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

  async function handleSave(skipLimitWarning = false) {
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
      });
      router.replace('/matched-bets');
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
      <SectionTitle>Nueva matched bet</SectionTitle>
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
      <AppInput label="Nota" value={notes} onChangeText={setNotes} multiline />
      <AppButton title="Guardar matched bet pendiente" onPress={() => void handleSave()} disabled={saving} />
    </Screen>
  );
}
