import { ApiError } from '@/utils/api-errors';

/** A cooperative query contract, not a sandbox for trusted in-process code. */
export function assertPluginDatabaseSql(sql: string, values: unknown): void {
  const invalid = (): never => { throw new ApiError('PLUGIN_ERROR'); };
  if (typeof sql !== 'string' || !sql.trim() || sql.includes('\0') || !Array.isArray(values)) invalid();
  let normalized = '', index = 0;
  while (index < sql.length) {
    if (sql.startsWith('--', index)) { const end = sql.indexOf('\n', index); index = end < 0 ? sql.length : end + 1; normalized += ' '; continue; }
    if (sql.startsWith('/*', index)) {
      let depth = 1; index += 2;
      while (depth && index < sql.length) {
        if (sql.startsWith('/*', index)) { depth++; index += 2; }
        else if (sql.startsWith('*/', index)) { depth--; index += 2; }
        else index++;
      }
      if (depth) invalid(); normalized += ' '; continue;
    }
    const dollar = sql.slice(index).match(/^\$(?:[a-zA-Z_][a-zA-Z0-9_]*)?\$/)?.[0];
    if (dollar) { const end = sql.indexOf(dollar, index + dollar.length); if (end < 0) invalid(); index = end + dollar.length; normalized += ' literal '; continue; }
    if (sql[index] === "'" || sql[index] === '"') {
      const quote = sql[index++]; let content = '', closed = false;
      while (index < sql.length) {
        const char = sql[index++];
        if (char === '\\') invalid();
        if (char === quote) { if (sql[index] === quote) { index++; content += char; continue; } closed = true; break; }
        content += char;
      }
      if (!closed) invalid(); normalized += quote === '"' ? ` ${content} ` : ' literal '; continue;
    }
    normalized += sql[index++];
  }
  const statements = normalized.split(';').map(value => value.trim()).filter(Boolean);
  if (statements.length !== 1 || !/^(SELECT|INSERT|UPDATE|DELETE|WITH)\b/i.test(statements[0])
    || /\b(SET_CONFIG|PG_ADVISORY_LOCK|PG_ADVISORY_UNLOCK|PG_ADVISORY_XACT_LOCK|PG_ADVISORY_LOCK_SHARED|PG_ADVISORY_UNLOCK_ALL|PG_TERMINATE_BACKEND|PG_CANCEL_BACKEND)\s*\(/i.test(normalized)
    || /\bINTO\s+(?:TEMP(?:ORARY)?\s+|UNLOGGED\s+)?[A-Za-z_"]/i.test(statements[0]) && /^SELECT\b/i.test(statements[0])) invalid();
}
