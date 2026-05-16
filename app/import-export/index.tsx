import * as DocumentPicker from 'expo-document-picker';
import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../src/components/AppButton';
import { AppCard } from '../../src/components/AppCard';
import { AppSelect } from '../../src/components/AppSelect';
import { Screen } from '../../src/components/Screen';
import { SectionTitle } from '../../src/components/SectionTitle';
import {
  exportJsonBackup,
  parseBackupJson,
  restoreJsonBackup,
} from '../../src/services/backupService';
import {
  CSV_EXPORT_OPTIONS,
  exportCsv,
  exportXlsxWorkbook,
  importCsvPreview,
  importXlsxPreview,
  previewCsvImportFromUri,
  previewXlsxImportFromUri,
  type CsvImportMode,
  type CsvImportPreview,
  type CsvTableName,
  type XlsxImportPreview,
} from '../../src/services/exportImport';
import { readTextFile } from '../../src/services/fileService';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';

export default function ImportExportScreen() {
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<CsvImportPreview | null>(null);
  const [xlsxPreview, setXlsxPreview] = useState<XlsxImportPreview | null>(null);
  const [mode, setMode] = useState<CsvImportMode>('add');

  async function handleExportCsv(tableName: CsvTableName) {
    setBusy(true);
    try {
      const result = await exportCsv(tableName);
      Alert.alert(
        'CSV generado',
        result.shared
          ? `Archivo compartido: ${result.fileName}`
          : `Archivo guardado en la app: ${result.fileName}`,
      );
    } catch (error) {
      Alert.alert('No se pudo exportar', error instanceof Error ? error.message : 'Error desconocido.');
    } finally {
      setBusy(false);
    }
  }

  async function handlePickCsv() {
    setBusy(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      const asset = result.assets[0];
      const nextPreview = await previewCsvImportFromUri(asset.uri, asset.name);
      setPreview(nextPreview);
      setXlsxPreview(null);
      setMode('add');
    } catch (error) {
      Alert.alert('No se pudo leer el CSV', error instanceof Error ? error.message : 'Error desconocido.');
    } finally {
      setBusy(false);
    }
  }

  async function handleExportXlsx() {
    setBusy(true);
    try {
      const result = await exportXlsxWorkbook();
      Alert.alert(
        'XLSX generado',
        result.shared
          ? `Archivo compartido: ${result.fileName}`
          : `Archivo guardado en la app: ${result.fileName}`,
      );
    } catch (error) {
      Alert.alert('No se pudo exportar XLSX', error instanceof Error ? error.message : 'Error desconocido.');
    } finally {
      setBusy(false);
    }
  }

  async function handlePickXlsx() {
    setBusy(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      const asset = result.assets[0];
      const nextPreview = await previewXlsxImportFromUri(asset.uri, asset.name);
      setXlsxPreview(nextPreview);
      setPreview(null);
      setMode('add');
    } catch (error) {
      Alert.alert('No se pudo leer el XLSX', error instanceof Error ? error.message : 'Error desconocido.');
    } finally {
      setBusy(false);
    }
  }

  async function runImport() {
    if (!preview) {
      return;
    }

    setBusy(true);
    try {
      const result = await importCsvPreview(preview, mode);
      Alert.alert(
        'Importacion completada',
        `Tabla: ${result.tableName}\nFilas: ${result.rowsTotal}\nInsertadas: ${result.rowsInserted}\nOmitidas: ${result.rowsSkipped}\nBackup previo: ${result.backupFileName}`,
      );
      setPreview(null);
    } catch (error) {
      Alert.alert('No se pudo importar', error instanceof Error ? error.message : 'Error desconocido.');
    } finally {
      setBusy(false);
    }
  }

  function handleImportPreview() {
    if (!preview || preview.errors.length > 0) {
      Alert.alert('CSV no valido', preview?.errors[0] ?? 'Selecciona un CSV valido.');
      return;
    }

    if (mode === 'replace') {
      Alert.alert(
        'Reemplazar datos',
        'Antes de importar se creara un backup automatico. El modo reemplazar puede borrar datos relacionados de la tabla seleccionada.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Reemplazar', style: 'destructive', onPress: runImport },
        ],
      );
      return;
    }

    void runImport();
  }

  async function runXlsxImport() {
    if (!xlsxPreview) {
      return;
    }

    setBusy(true);
    try {
      const results = await importXlsxPreview(xlsxPreview, mode);
      const inserted = results.reduce((sum, item) => sum + item.rowsInserted, 0);
      const skipped = results.reduce((sum, item) => sum + item.rowsSkipped, 0);
      Alert.alert(
        'XLSX importado',
        `Hojas importadas: ${results.length}\nInsertadas: ${inserted}\nOmitidas: ${skipped}`,
      );
      setXlsxPreview(null);
    } catch (error) {
      Alert.alert('No se pudo importar XLSX', error instanceof Error ? error.message : 'Error desconocido.');
    } finally {
      setBusy(false);
    }
  }

  function handleXlsxImportPreview() {
    if (!xlsxPreview || xlsxPreview.errors.length > 0) {
      Alert.alert('XLSX no valido', xlsxPreview?.errors[0] ?? 'Selecciona un XLSX valido.');
      return;
    }

    if (mode === 'replace') {
      Alert.alert(
        'Reemplazar datos',
        'Antes de importar se crearan backups automaticos. El modo reemplazar puede borrar datos relacionados.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Reemplazar', style: 'destructive', onPress: runXlsxImport },
        ],
      );
      return;
    }

    void runXlsxImport();
  }

  async function handleExportBackup() {
    setBusy(true);
    try {
      const result = await exportJsonBackup({ share: true });
      Alert.alert(
        'Backup generado',
        result.shared
          ? `Copia compartida: ${result.fileName}`
          : `Copia guardada en la app: ${result.fileName}`,
      );
    } catch (error) {
      Alert.alert('No se pudo crear el backup', error instanceof Error ? error.message : 'Error desconocido.');
    } finally {
      setBusy(false);
    }
  }

  async function handleRestoreBackup() {
    setBusy(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      const asset = result.assets[0];
      const content = await readTextFile(asset.uri);
      const backup = parseBackupJson(content);

      Alert.alert(
        'Restaurar copia',
        `Backup: ${asset.name}\nFecha: ${backup.created_at}\n\nSe creara un backup automatico del estado actual y luego se reemplazaran los datos.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Restaurar',
            style: 'destructive',
            onPress: async () => {
              setBusy(true);
              try {
                await exportJsonBackup({ share: false });
                await restoreJsonBackup(content);
                Alert.alert('Backup restaurado', 'Los datos se han restaurado correctamente.');
              } catch (error) {
                Alert.alert(
                  'No se pudo restaurar',
                  error instanceof Error ? error.message : 'Error desconocido.',
                );
              } finally {
                setBusy(false);
              }
            },
          },
        ],
      );
    } catch (error) {
      Alert.alert('No se pudo leer el backup', error instanceof Error ? error.message : 'Error desconocido.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <SectionTitle>Importar/exportar</SectionTitle>
      <Text style={styles.note}>
        CSV separado por punto y coma compatible con Excel en Espana. Los backups JSON
        contienen toda la base de datos.
      </Text>

      {busy ? <ActivityIndicator color={colors.primary} /> : null}

      <AppCard>
        <Text style={styles.title}>Exportar CSV</Text>
        <View style={styles.actions}>
          {CSV_EXPORT_OPTIONS.map((option) => (
            <AppButton
              key={option.tableName}
              title={option.label}
              onPress={() => handleExportCsv(option.tableName)}
              variant="secondary"
              disabled={busy}
            />
          ))}
        </View>
      </AppCard>

      <AppCard>
        <Text style={styles.title}>Excel XLSX</Text>
        <Text style={styles.text}>
          Exporta un libro con hojas para cuentas, movimientos, apuestas, matched betting,
          transferencias, categorias, resumen mensual y estadisticas.
        </Text>
        <View style={styles.actions}>
          <AppButton title="Exportar XLSX" onPress={handleExportXlsx} disabled={busy} />
          <AppButton title="Seleccionar XLSX" onPress={handlePickXlsx} variant="secondary" disabled={busy} />
        </View>

        {xlsxPreview ? (
          <View style={styles.preview}>
            <Text style={styles.subtitle}>Vista previa XLSX</Text>
            <Text style={styles.text}>Archivo: {xlsxPreview.fileName}</Text>
            <Text style={styles.text}>Hojas detectadas: {xlsxPreview.sheets.length}</Text>
            {xlsxPreview.errors.length > 0 ? (
              <Text style={styles.error}>{xlsxPreview.errors.join('\n')}</Text>
            ) : null}
            {xlsxPreview.sheets.map((sheet) => (
              <Text key={sheet.fileName} style={styles.text}>
                {sheet.tableLabel}: {sheet.totalRows} filas, {sheet.duplicateRows} duplicados
              </Text>
            ))}
            <AppSelect
              label="Modo"
              value={mode}
              options={[
                { label: 'Anadir', value: 'add' },
                { label: 'Reemplazar', value: 'replace' },
              ]}
              onChange={(value) => setMode(value as CsvImportMode)}
            />
            <AppButton
              title="Importar XLSX"
              onPress={handleXlsxImportPreview}
              disabled={busy || xlsxPreview.errors.length > 0}
            />
          </View>
        ) : null}
      </AppCard>

      <AppCard>
        <Text style={styles.title}>Importar CSV</Text>
        <Text style={styles.text}>
          Selecciona un CSV exportado por la app o con cabeceras compatibles. Se mostrara una
          vista previa antes de importar.
        </Text>
        <AppButton title="Seleccionar CSV" onPress={handlePickCsv} disabled={busy} />

        {preview ? (
          <View style={styles.preview}>
            <Text style={styles.subtitle}>Vista previa</Text>
            <Text style={styles.text}>Archivo: {preview.fileName}</Text>
            <Text style={styles.text}>
              Tabla detectada: {preview.tableLabel ?? 'No detectada'}
            </Text>
            <Text style={styles.text}>Filas: {preview.totalRows}</Text>
            <Text style={styles.text}>Duplicados existentes: {preview.duplicateRows}</Text>
            {preview.errors.length > 0 ? (
              <Text style={styles.error}>{preview.errors.join('\n')}</Text>
            ) : null}
            <Text style={styles.sample}>{formatSampleRows(preview.sampleRows)}</Text>
            <AppSelect
              label="Modo"
              value={mode}
              options={[
                { label: 'Anadir', value: 'add' },
                { label: 'Reemplazar', value: 'replace' },
              ]}
              onChange={(value) => setMode(value as CsvImportMode)}
            />
            <AppButton
              title="Importar CSV"
              onPress={handleImportPreview}
              disabled={busy || preview.errors.length > 0}
            />
          </View>
        ) : null}
      </AppCard>

      <AppCard>
        <Text style={styles.title}>Copia de seguridad completa</Text>
        <Text style={styles.text}>
          Exporta o restaura todas las tablas: cuentas, movimientos, transferencias,
          apuestas, matched betting, categorias, ajustes, backups e historial.
        </Text>
        <View style={styles.actions}>
          <AppButton title="Exportar backup JSON" onPress={handleExportBackup} disabled={busy} />
          <AppButton
            title="Restaurar backup JSON"
            onPress={handleRestoreBackup}
            variant="danger"
            disabled={busy}
          />
        </View>
      </AppCard>
    </Screen>
  );
}

function formatSampleRows(rows: Record<string, string>[]): string {
  if (rows.length === 0) {
    return 'Sin filas para previsualizar.';
  }

  return rows
    .map((row, index) => {
      const cells = Object.entries(row)
        .slice(0, 5)
        .map(([key, value]) => `${key}: ${value}`)
        .join(' | ');
      return `${index + 1}. ${cells}`;
    })
    .join('\n');
}

const styles = StyleSheet.create({
  note: {
    color: colors.muted,
    fontSize: 14,
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  text: {
    color: colors.text,
    fontSize: 14,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
  },
  actions: {
    gap: spacing.sm,
  },
  preview: {
    borderColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
  },
  sample: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 8,
    color: colors.text,
    fontSize: 12,
    padding: spacing.sm,
  },
});
