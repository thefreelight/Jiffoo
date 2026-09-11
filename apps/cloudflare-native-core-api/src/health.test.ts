import { describe, expect, it } from 'vitest';
import { isExpectedNativeSchemaVersion, isSupportedNativeSchemaVersion } from './health';

describe('native health schema gate', () => {
  it('accepts the current and compatible native schema lines', () => {
    expect(isSupportedNativeSchemaVersion('0054')).toBe(true);
    expect(isSupportedNativeSchemaVersion('0053')).toBe(true);
    expect(isSupportedNativeSchemaVersion('0052')).toBe(true);
    expect(isSupportedNativeSchemaVersion('0051')).toBe(true);
    expect(isSupportedNativeSchemaVersion('0050')).toBe(true);
    expect(isSupportedNativeSchemaVersion('0049')).toBe(true);
    expect(isSupportedNativeSchemaVersion('0048')).toBe(true);
    expect(isSupportedNativeSchemaVersion('0047')).toBe(true);
    expect(isSupportedNativeSchemaVersion('0046')).toBe(true);
    expect(isSupportedNativeSchemaVersion('0045')).toBe(true);
    expect(isSupportedNativeSchemaVersion('0044')).toBe(true);
    expect(isSupportedNativeSchemaVersion('0043')).toBe(true);
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
    expect(isSupportedNativeSchemaVersion('0054')).toBe(false);
    expect(isSupportedNativeSchemaVersion(null)).toBe(false);
    expect(isSupportedNativeSchemaVersion(undefined)).toBe(false);
  });

  it('accepts an instance schema only when it exactly matches the configured expectation', () => {
    expect(isExpectedNativeSchemaVersion('0027', '0027')).toBe(true);
    expect(isExpectedNativeSchemaVersion('0026', '0027')).toBe(false);
    expect(isExpectedNativeSchemaVersion('0039', '0027')).toBe(false);
    expect(isExpectedNativeSchemaVersion(null, '0027')).toBe(false);
  });

  it('uses the native compatibility line when no instance expectation is configured', () => {
    expect(isExpectedNativeSchemaVersion('0043', undefined)).toBe(true);
    expect(isExpectedNativeSchemaVersion('0027', undefined)).toBe(false);
  });
});
