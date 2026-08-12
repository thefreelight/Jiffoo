import { describe, expect, it } from 'vitest';
import { isSupportedNativeSchemaVersion } from './health';

describe('native health schema gate', () => {
  it('accepts the current and compatible native schema lines', () => {
    expect(isSupportedNativeSchemaVersion('0042')).toBe(true);
    expect(isSupportedNativeSchemaVersion('0041')).toBe(true);
    expect(isSupportedNativeSchemaVersion('0040')).toBe(true);
    expect(isSupportedNativeSchemaVersion('0039')).toBe(true);
    expect(isSupportedNativeSchemaVersion('0038')).toBe(true);
    expect(isSupportedNativeSchemaVersion('0037')).toBe(true);
    expect(isSupportedNativeSchemaVersion('0036')).toBe(true);
    expect(isSupportedNativeSchemaVersion('0035')).toBe(true);
  });

  it('degrades unknown, missing, and older schema lines', () => {
    expect(isSupportedNativeSchemaVersion('0034')).toBe(false);
    expect(isSupportedNativeSchemaVersion(null)).toBe(false);
    expect(isSupportedNativeSchemaVersion(undefined)).toBe(false);
  });
});
