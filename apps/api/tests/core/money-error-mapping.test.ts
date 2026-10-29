import { describe, expect, it } from 'vitest';
import { MoneyError, decimalToMinor, minorToDecimal, type MoneyErrorReason } from '@/core/shared/money';
import { ApiError, mapApiError } from '@/utils/api-errors';

/**
 * The money module rejects amounts it cannot represent with a neutral domain
 * error, and the API boundary turns that error into a client error instead of
 * an internal error. These tests pin that contract change (500 -> 400).
 */
function expectMoneyError(run: () => unknown, reason: MoneyErrorReason, detail?: string): MoneyError {
  let caught: unknown;
  try { run(); } catch (error) { caught = error; }
  expect(caught).toBeInstanceOf(MoneyError);
  const moneyError = caught as MoneyError;
  expect(moneyError.name).toBe('MoneyError');
  expect(moneyError.reason).toBe(reason);
  if (detail !== undefined) expect(moneyError.detail).toBe(detail);
  return moneyError;
}

describe('money error contract', () => {
  it('A: an amount that is not a decimal number throws MoneyError with reason INVALID_DECIMAL', () => {
    expectMoneyError(() => decimalToMinor('abc', 'USD'), 'INVALID_DECIMAL', 'Invalid decimal amount: abc');
    expectMoneyError(() => decimalToMinor('12,50', 'USD'), 'INVALID_DECIMAL', 'Invalid decimal amount: 12,50');
    expectMoneyError(() => decimalToMinor('1.2.3', 'USD'), 'INVALID_DECIMAL', 'Invalid decimal amount: 1.2.3');
    expectMoneyError(() => decimalToMinor('', 'USD'), 'INVALID_DECIMAL', 'Invalid decimal amount: ');
  });

  it('B: an amount with more decimal places than the currency allows throws MoneyError with reason TOO_MANY_DECIMAL_PLACES', () => {
    expectMoneyError(() => decimalToMinor('1.234', 'USD'), 'TOO_MANY_DECIMAL_PLACES', 'Amount has too many decimal places for USD');
    expectMoneyError(() => decimalToMinor('1.2345', 'USD'), 'TOO_MANY_DECIMAL_PLACES', 'Amount has too many decimal places for USD');
    expectMoneyError(() => decimalToMinor('100.50', 'JPY'), 'TOO_MANY_DECIMAL_PLACES', 'Amount has too many decimal places for JPY');
    expectMoneyError(() => decimalToMinor('10.505', 'USD'), 'TOO_MANY_DECIMAL_PLACES', 'Amount has too many decimal places for USD');
    expect(() => decimalToMinor('1.234', 'KWD')).not.toThrow();
  });

  it('B2: an amount whose extra decimal places are all zero is representable and is not rounded', () => {
    expect(decimalToMinor('100.00', 'JPY')).toBe(100);
    expect(decimalToMinor('1.0', 'JPY')).toBe(1);
    expect(decimalToMinor('10.500', 'USD')).toBe(1050);
    expect(decimalToMinor('10.50', 'USD')).toBe(1050);
    expect(decimalToMinor(100, 'JPY')).toBe(100);
  });

  it('C: an amount outside the safe integer range throws MoneyError with reason OUT_OF_SAFE_RANGE', () => {
    expectMoneyError(() => decimalToMinor('99999999999999999999', 'USD'), 'OUT_OF_SAFE_RANGE', 'Amount exceeds safe integer range');
    expectMoneyError(() => decimalToMinor('-99999999999999999999', 'USD'), 'OUT_OF_SAFE_RANGE', 'Amount exceeds safe integer range');
  });

  it('D: a minor amount that is not a safe integer throws MoneyError with reason UNSAFE_MINOR_AMOUNT', () => {
    expectMoneyError(() => minorToDecimal(1.5, 'USD'), 'UNSAFE_MINOR_AMOUNT', 'Minor amount must be a safe integer');
    expectMoneyError(() => minorToDecimal(Number.NaN, 'USD'), 'UNSAFE_MINOR_AMOUNT', 'Minor amount must be a safe integer');
  });

  it('E: valid amounts keep their conversion, precision and rounding', () => {
    expect(decimalToMinor('12.34', 'USD')).toBe(1234);
    expect(decimalToMinor('-12.34', 'USD')).toBe(-1234);
    expect(decimalToMinor('0.01', 'USD')).toBe(1);
    expect(decimalToMinor('1234', 'JPY')).toBe(1234);
    expect(decimalToMinor('1.234', 'KWD')).toBe(1234);
    expect(decimalToMinor(' 12.34 ', 'USD')).toBe(1234);
    expect(minorToDecimal(1234, 'USD')).toBe('12.34');
    expect(minorToDecimal(-1234, 'USD')).toBe('-12.34');
    expect(minorToDecimal(1234, 'JPY')).toBe('1234');
    expect(minorToDecimal(1234, 'KWD')).toBe('1.234');
  });

  it('F: a MoneyError maps to VALIDATION_ERROR with a 4xx status instead of INTERNAL_SERVER_ERROR', () => {
    const reasons: MoneyErrorReason[] = ['INVALID_DECIMAL', 'TOO_MANY_DECIMAL_PLACES', 'OUT_OF_SAFE_RANGE', 'UNSAFE_MINOR_AMOUNT'];
    for (const reason of reasons) {
      const mapped = mapApiError(new MoneyError(reason, 'diagnostic detail'));
      expect(mapped.status).toBe(400);
      expect(mapped.status).toBeLessThan(500);
      expect(mapped.body).toMatchObject({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Request validation failed' } });
      expect(mapped.body.error.code).not.toBe('INTERNAL_SERVER_ERROR');
      expect(JSON.stringify(mapped.body)).not.toMatch(/stack|cause/);
    }
  });

  it('G: the error thrown by the money module maps to VALIDATION_ERROR, not to an internal error', () => {
    let thrown: unknown;
    try { decimalToMinor('12,50', 'USD'); } catch (error) { thrown = error; }
    const mapped = mapApiError(thrown);
    expect(mapped.status).toBe(400);
    expect(mapped.body.error.code).toBe('VALIDATION_ERROR');
    expect(mapped.body.error.code).not.toBe('INTERNAL_SERVER_ERROR');
  });

  it('H: the money mapping does not change the mapping of other errors', () => {
    expect(mapApiError(new Error('boom')).status).toBe(500);
    expect(mapApiError(new Error('boom')).body.error.code).toBe('INTERNAL_SERVER_ERROR');
    expect(mapApiError(new ApiError('BAD_REQUEST')).status).toBe(400);
    expect(mapApiError(new ApiError('BAD_REQUEST')).body.error.code).toBe('BAD_REQUEST');
  });
});
