import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isExpectedNativeSchemaVersion, isSupportedNativeSchemaVersion } from './health';

describe('native health schema gate', () => {
  it('accepts the current and compatible native schema lines', () => {
    expect(isSupportedNativeSchemaVersion('0084')).toBe(true);
    expect(isSupportedNativeSchemaVersion('0083')).toBe(true);
    expect(isSupportedNativeSchemaVersion('0082')).toBe(true);
    expect(isSupportedNativeSchemaVersion('0081')).toBe(true);
    expect(isSupportedNativeSchemaVersion('0080')).toBe(true);
    expect(isSupportedNativeSchemaVersion('0079')).toBe(true);
    expect(isSupportedNativeSchemaVersion('0078')).toBe(true);
    expect(isSupportedNativeSchemaVersion('0077')).toBe(true);
    expect(isSupportedNativeSchemaVersion('0061')).toBe(true);
    expect(isSupportedNativeSchemaVersion('0060')).toBe(true);
    expect(isSupportedNativeSchemaVersion('0059')).toBe(true);
    expect(isSupportedNativeSchemaVersion('0058')).toBe(true);
    expect(isSupportedNativeSchemaVersion('0057')).toBe(true);
    expect(isSupportedNativeSchemaVersion('0056')).toBe(true);
    expect(isSupportedNativeSchemaVersion('0055')).toBe(true);
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

  it('accepts the newest migration as a schema line', () => {
    // A migration missing from the whitelist reports /health degraded on every
    // instance that has no EXPECTED_D1_SCHEMA_VERSION pin.
    const newest = readdirSync(resolve(import.meta.dirname, '../migrations'))
      .filter((name) => /^\d{4}_.*\.sql$/.test(name))
      .sort()
      .at(-1)!
      .slice(0, 4);
    expect(isSupportedNativeSchemaVersion(newest)).toBe(true);
  });

  it('degrades unknown, missing, and older schema lines', () => {
    expect(isSupportedNativeSchemaVersion('0034')).toBe(false);
    expect(isSupportedNativeSchemaVersion('0099')).toBe(false);
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
