const SUPPORTED_NATIVE_SCHEMA_VERSIONS = new Set(['0035', '0036', '0037', '0038', '0039', '0040', '0041', '0042', '0043', '0044', '0045', '0046', '0047', '0048', '0049', '0050', '0051', '0052', '0053', '0054']);

export function isSupportedNativeSchemaVersion(value: string | null | undefined): boolean {
  return value !== undefined && value !== null && SUPPORTED_NATIVE_SCHEMA_VERSIONS.has(value);
}

export function isExpectedNativeSchemaVersion(
  value: string | null | undefined,
  expectedValue: string | null | undefined,
): boolean {
  if (value === undefined || value === null) return false;
  if (expectedValue !== undefined && expectedValue !== null && expectedValue !== '') {
    return value === expectedValue;
  }
  return isSupportedNativeSchemaVersion(value);
}
