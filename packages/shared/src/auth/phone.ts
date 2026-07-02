/** Normalizes South African numbers to E.164 (e.g. "082 123 4567" -> "+27821234567"). */
export function normalizeSouthAfricanPhone(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, '');

  if (digits.startsWith('+')) {
    return digits;
  }
  if (digits.startsWith('0')) {
    return `+27${digits.slice(1)}`;
  }
  if (digits.startsWith('27')) {
    return `+${digits}`;
  }
  return `+27${digits}`;
}

export function isValidSouthAfricanPhone(raw: string): boolean {
  const normalized = normalizeSouthAfricanPhone(raw);
  return /^\+27\d{9}$/.test(normalized);
}
