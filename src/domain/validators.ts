export function assertRequired(value: unknown, fieldName: string): void {
  if (value === null || value === undefined || value === '') {
    throw new Error(`${fieldName} es obligatorio.`);
  }
}

export function assertPositiveAmount(value: number, fieldName: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${fieldName} debe ser mayor que 0.`);
  }
}

export function assertNonNegativeAmount(value: number, fieldName: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${fieldName} no puede ser negativo.`);
  }
}

export function assertOdds(value: number, fieldName = 'Cuota'): void {
  if (!Number.isFinite(value) || value <= 1) {
    throw new Error(`${fieldName} debe ser mayor que 1.`);
  }
}

export function assertDifferentAccounts(fromAccountId: string, toAccountId: string): void {
  if (fromAccountId === toAccountId) {
    throw new Error('La cuenta origen y la cuenta destino deben ser distintas.');
  }
}
