const SUPPORTED_NATIVE_SCHEMA_VERSIONS = new Set(['0035', '0036', '0037', '0038']);

export function isSupportedNativeSchemaVersion(value: string | null | undefined): boolean {
  return value !== undefined && value !== null && SUPPORTED_NATIVE_SCHEMA_VERSIONS.has(value);
}
