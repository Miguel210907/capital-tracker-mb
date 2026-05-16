import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { nowIso } from '../utils/dates';

const APP_EXPORT_DIR = `${FileSystem.documentDirectory ?? ''}capital-tracker-mb/`;
const BACKUP_DIR = `${APP_EXPORT_DIR}backups/`;
const EXPORT_DIR = `${APP_EXPORT_DIR}exports/`;

export interface SavedFile {
  uri: string;
  fileName: string;
  createdAt: string;
}

export async function saveTextFile(
  fileName: string,
  contents: string,
  kind: 'backup' | 'export' = 'export',
): Promise<SavedFile> {
  const directory = kind === 'backup' ? BACKUP_DIR : EXPORT_DIR;
  await ensureDirectory(directory);

  const uri = `${directory}${sanitizeFileName(fileName)}`;
  await FileSystem.writeAsStringAsync(uri, contents);

  return {
    uri,
    fileName: sanitizeFileName(fileName),
    createdAt: nowIso(),
  };
}

export async function saveBase64File(
  fileName: string,
  contents: string,
  kind: 'backup' | 'export' = 'export',
): Promise<SavedFile> {
  const directory = kind === 'backup' ? BACKUP_DIR : EXPORT_DIR;
  await ensureDirectory(directory);

  const uri = `${directory}${sanitizeFileName(fileName)}`;
  await FileSystem.writeAsStringAsync(uri, contents, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return {
    uri,
    fileName: sanitizeFileName(fileName),
    createdAt: nowIso(),
  };
}

export async function readTextFile(uri: string): Promise<string> {
  return FileSystem.readAsStringAsync(uri);
}

export async function readBase64File(uri: string): Promise<string> {
  return FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
}

export async function shareFile(uri: string): Promise<boolean> {
  const available = await Sharing.isAvailableAsync();

  if (!available) {
    return false;
  }

  await Sharing.shareAsync(uri);
  return true;
}

export function timestampForFileName(date = new Date()): string {
  return date.toISOString().replace(/[:.]/g, '-');
}

async function ensureDirectory(directory: string): Promise<void> {
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true }).catch(() => undefined);
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[\\/:*?"<>|]/g, '-');
}
