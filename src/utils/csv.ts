export interface CsvParseResult {
  headers: string[];
  rows: Record<string, string>[];
}

const CSV_SEPARATOR = ';';
const UTF8_BOM = '\ufeff';

export function serializeCsv(rows: Array<Record<string, unknown>>, headers: string[]): string {
  const lines = [
    headers.map(escapeCsvCell).join(CSV_SEPARATOR),
    ...rows.map((row) => headers.map((header) => escapeCsvCell(row[header])).join(CSV_SEPARATOR)),
  ];

  return `${UTF8_BOM}${lines.join('\n')}`;
}

export function parseCsv(content: string): CsvParseResult {
  const normalized = stripBom(content).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const records = parseCsvRecords(normalized);

  if (records.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = records[0].map((header) => header.trim());
  const rows = records
    .slice(1)
    .filter((record) => record.some((cell) => cell.trim() !== ''))
    .map((record) => {
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = record[index] ?? '';
      });
      return row;
    });

  return { headers, rows };
}

export function normalizeCsvNumber(value: string | number | null | undefined): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (!value) {
    return 0;
  }

  const trimmed = value.trim();
  const normalized = trimmed.includes(',')
    ? trimmed.replace(/\./g, '').replace(',', '.')
    : trimmed;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function normalizeCsvText(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
}

function stripBom(value: string): string {
  return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value;
}

function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  const text = typeof value === 'number' ? String(value).replace('.', ',') : String(value);
  const escaped = text.replace(/"/g, '""');

  if (
    escaped.includes(CSV_SEPARATOR) ||
    escaped.includes('"') ||
    escaped.includes('\n') ||
    escaped.includes('\r')
  ) {
    return `"${escaped}"`;
  }

  return escaped;
}

function parseCsvRecords(content: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const nextChar = content[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === CSV_SEPARATOR && !inQuotes) {
      record.push(cell);
      cell = '';
      continue;
    }

    if (char === '\n' && !inQuotes) {
      record.push(cell);
      records.push(record);
      record = [];
      cell = '';
      continue;
    }

    cell += char;
  }

  if (cell !== '' || record.length > 0) {
    record.push(cell);
    records.push(record);
  }

  return records;
}
