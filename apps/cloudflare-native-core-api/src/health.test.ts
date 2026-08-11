import { describe, expect, it } from 'vitest';
import { isSupportedNativeSchemaVersion } from './health';

describe('native health schema gate', () => {
  it('accepts the current 0036 line and the immediately previous compatible line', () => {
    expect(isSupportedNativeSchemaVersion('0036')).toBe(true);
    expect(isSupportedNativeSchemaVersion('0035')).toBe(true);
  });

  it('degrades unknown, missing, and older schema lines', () => {
    expect(isSupportedNativeSchemaVersion('0034')).toBe(false);
    expect(isSupportedNativeSchemaVersion(null)).toBe(false);
    expect(isSupportedNativeSchemaVersion(undefined)).toBe(false);
  });
});
