const CURRENCY_EXPONENTS: Record<string, number> = { JPY: 0, KRW: 0, VND: 0, BHD: 3, JOD: 3, KWD: 3, OMR: 3, TND: 3 };
export function currencyExponent(currency: string): number { return CURRENCY_EXPONENTS[currency.toUpperCase()] ?? 2; }
export function decimalToMinor(value: string | number, currency: string): number {
  const exponent = currencyExponent(currency); const raw = String(value).trim();
  if (!/^-?\d+(?:\.\d+)?$/.test(raw)) throw new Error(`Invalid decimal amount: ${raw}`);
  const negative = raw.startsWith('-'); const [wholeRaw, fractionRaw = ''] = (negative ? raw.slice(1) : raw).split('.');
  if (fractionRaw.length > exponent || (exponent === 0 && fractionRaw.length)) throw new Error(`Amount has too many decimal places for ${currency}`);
  const minor = BigInt(wholeRaw) * (10n ** BigInt(exponent)) + BigInt((fractionRaw + '0'.repeat(exponent)).slice(0, exponent) || '0');
  const signed = negative ? -minor : minor;
  if (signed > BigInt(Number.MAX_SAFE_INTEGER) || signed < BigInt(Number.MIN_SAFE_INTEGER)) throw new Error('Amount exceeds safe integer range');
  return Number(signed);
}
export function minorToDecimal(amountMinor: number, currency: string): string {
  if (!Number.isSafeInteger(amountMinor)) throw new Error('Minor amount must be a safe integer');
  const exponent = currencyExponent(currency); const sign = amountMinor < 0 ? '-' : ''; const raw = Math.abs(amountMinor).toString();
  if (exponent === 0) return `${sign}${raw}`;
  const padded = raw.padStart(exponent + 1, '0'); return `${sign}${padded.slice(0, -exponent)}.${padded.slice(-exponent)}`;
}
