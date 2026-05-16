export function nowIso(): string {
  return new Date().toISOString();
}

export function todayDbDate(): string {
  return toDbDate(new Date());
}

export function todaySpanishDate(): string {
  return formatSpanishDate(todayDbDate());
}

export function toDbDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function startOfMonthDbDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}

export function endOfMonthDbDate(date = new Date()): string {
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return toDbDate(lastDay);
}

export function formatSpanishDate(dbDate: string): string {
  const [year, month, day] = dbDate.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}

export function parseSpanishDateInput(value: string): string {
  const trimmed = value.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed);
  if (!match) {
    throw new Error('La fecha debe tener formato dd/mm/yyyy.');
  }

  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
}
