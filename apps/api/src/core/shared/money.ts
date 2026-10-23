export const CURRENCY_EXPONENTS: Record<string, number> = { JPY: 0, KRW: 0, VND: 0, BHD: 3, JOD: 3, KWD: 3, OMR: 3, TND: 3 };

/** Why an amount could not be represented. Neutral diagnostic detail; no HTTP meaning. */
export type MoneyErrorReason = 'INVALID_DECIMAL' | 'TOO_MANY_DECIMAL_PLACES' | 'OUT_OF_SAFE_RANGE' | 'UNSAFE_MINOR_AMOUNT';

/** Domain error for amounts the money module cannot convert. Carries diagnostics, never HTTP semantics. */
export class MoneyError extends Error {
  constructor(readonly reason: MoneyErrorReason, readonly detail: string) {
    super(detail);
    this.name = 'MoneyError';
  }
}

export function currencyExponent(currency: string): number { return CURRENCY_EXPONENTS[currency.toUpperCase()] ?? 2; }
export function decimalToMinor(value: string | number, currency: string): number {
  const exponent = currencyExponent(currency); const raw = String(value).trim();
  if (!/^-?\d+(?:\.\d+)?$/.test(raw)) throw new MoneyError('INVALID_DECIMAL', `Invalid decimal amount: ${raw}`);
  const negative = raw.startsWith('-'); const [wholeRaw, fractionRaw = ''] = (negative ? raw.slice(1) : raw).split('.');
  if (fractionRaw.length > exponent || (exponent === 0 && fractionRaw.length)) throw new MoneyError('TOO_MANY_DECIMAL_PLACES', `Amount has too many decimal places for ${currency}`);
  const minor = BigInt(wholeRaw) * (10n ** BigInt(exponent)) + BigInt((fractionRaw + '0'.repeat(exponent)).slice(0, exponent) || '0');
  const signed = negative ? -minor : minor;
  if (signed > BigInt(Number.MAX_SAFE_INTEGER) || signed < BigInt(Number.MIN_SAFE_INTEGER)) throw new MoneyError('OUT_OF_SAFE_RANGE', 'Amount exceeds safe integer range');
  return Number(signed);
}
export function minorToDecimal(amountMinor: number, currency: string): string {
  if (!Number.isSafeInteger(amountMinor)) throw new MoneyError('UNSAFE_MINOR_AMOUNT', 'Minor amount must be a safe integer');
  const exponent = currencyExponent(currency); const sign = amountMinor < 0 ? '-' : ''; const raw = Math.abs(amountMinor).toString();
  if (exponent === 0) return `${sign}${raw}`;
  const padded = raw.padStart(exponent + 1, '0'); return `${sign}${padded.slice(0, -exponent)}.${padded.slice(-exponent)}`;
}
