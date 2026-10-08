import { createHash } from 'node:crypto';
import { pluginDatabaseDeclarationIsValid, type PluginMigrationDeclaration } from './extensions/plugin-contract';

export class PluginMigrationValidationError extends Error {
  constructor(readonly code: 'PLUGIN_MIGRATION_MANIFEST_INVALID' | 'PLUGIN_MIGRATION_DRIFT') { super(code); }
}

export type MigrationPackageFile = { path: string; content: Uint8Array; mode?: number };
export function pluginSchemaName(slug: string): string {
  const name = `plugin_${slug.replace(/[^a-z0-9]/g, '_')}`;
  if (!/^[a-z][a-z0-9_]*$/.test(name) || Buffer.byteLength(name) > 63) {
    throw new PluginMigrationValidationError('PLUGIN_MIGRATION_MANIFEST_INVALID');
  }
  return name;
}

/** Validate the immutable package bytes without loading any executable module. */
export function validatePluginMigrations(database: unknown, files: readonly MigrationPackageFile[], applied: readonly PluginMigrationDeclaration[] = []): PluginMigrationDeclaration[] {
  const invalid = (): never => { throw new PluginMigrationValidationError('PLUGIN_MIGRATION_MANIFEST_INVALID'); };
  if (database !== undefined && !pluginDatabaseDeclarationIsValid(database)) invalid();
  const declarations = database === undefined ? [] : (database as { migrations: PluginMigrationDeclaration[] }).migrations;
  const paths = new Set<string>();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  for (const file of files) {
    const folded = file.path.toLowerCase();
    if (paths.has(folded) || file.path.includes('\\') || file.path.startsWith('/')
      || file.path.split('/').some(part => part === '..' || part === '.')
      || /[\u0000-\u001f\u007f]/.test(file.path) || /:/.test(file.path)
      || (file.mode !== undefined && (file.mode & 0o170000) === 0o120000)) invalid();
    paths.add(folded);
    if (!folded.endsWith('.sql')) continue;
    const declaration = declarations.find(item => item.path === file.path);
    if (!declaration || !/^migrations\/[A-Za-z0-9][A-Za-z0-9_.-]*\.sql$/.test(file.path) || file.path.includes('..')) return invalid();
    const bytes = Buffer.from(file.content);
    if (bytes.includes(0) || (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf)) invalid();
    let sql: string;
    try { sql = decoder.decode(bytes); } catch { return invalid(); }
    if (createHash('sha256').update(bytes).digest('hex') !== declaration.sha256) invalid();
    validateTransactionalMigrationSql(sql);
  }
  if (declarations.some(item => !files.some(file => file.path === item.path))) invalid();
  if (applied.length > declarations.length || applied.some((item, index) => {
    const candidate = declarations[index];
    return !candidate || item.id !== candidate.id || item.order !== candidate.order || item.path !== candidate.path || item.sha256 !== candidate.sha256;
  })) throw new PluginMigrationValidationError('PLUGIN_MIGRATION_DRIFT');
  return declarations.map(item => ({ ...item }));
}

/** Strip literals and comments before inspecting top-level SQL statements. */
export function validateTransactionalMigrationSql(sql: string): void {
  const invalid = (): never => { throw new PluginMigrationValidationError('PLUGIN_MIGRATION_MANIFEST_INVALID'); };
  let tokens = '', index = 0;
  while (index < sql.length) {
    const rest = sql.slice(index);
    if (rest.startsWith('--')) { const end = sql.indexOf('\n', index); index = end < 0 ? sql.length : end + 1; tokens += ' '; continue; }
    if (rest.startsWith('/*')) {
      let depth = 1; index += 2;
      while (depth && index < sql.length) {
        if (sql.startsWith('/*', index)) { depth++; index += 2; }
        else if (sql.startsWith('*/', index)) { depth--; index += 2; }
        else index++;
      }
      if (depth) invalid(); tokens += ' '; continue;
    }
    const dollar = rest.match(/^\$(?:[a-zA-Z_][a-zA-Z0-9_]*)?\$/)?.[0];
    if (dollar) { const end = sql.indexOf(dollar, index + dollar.length); if (end < 0) invalid(); index = end + dollar.length; tokens += ' literal '; continue; }
    if (sql[index] === "'" || sql[index] === '"') {
      const quote = sql[index++]; let closed = false;
      while (index < sql.length) {
        if (sql[index] === quote) { if (sql[index + 1] === quote) { index += 2; continue; } index++; closed = true; break; }
        // Conservatively reject escape-string literals whose token boundaries are ambiguous.
        if (sql[index] === '\\') invalid(); index++;
      }
      if (!closed) invalid(); tokens += ' literal '; continue;
    }
    if (sql[index] === '\\') invalid();
    tokens += sql[index++];
  }
  for (const statement of tokens.split(';').map(value => value.trim().toUpperCase()).filter(Boolean)) {
    if (/^(BEGIN|START\s+TRANSACTION|COMMIT|END|ROLLBACK|ABORT|SAVEPOINT|RELEASE|SET|RESET|DISCARD|VACUUM|CLUSTER|CHECKPOINT|REINDEX|LISTEN|UNLISTEN|PREPARE|EXECUTE|DEALLOCATE|CALL|DO)\b/.test(statement)
      || /^(CREATE|DROP|ALTER)\s+(DATABASE|TABLESPACE|SUBSCRIPTION|SYSTEM)\b/.test(statement)
      || /\bCONCURRENTLY\b/.test(statement)
      || /^COPY\b[\s\S]*\b(STDIN|STDOUT|PROGRAM)\b/.test(statement)
      || /\b(SET_CONFIG|PG_ADVISORY_LOCK|PG_ADVISORY_UNLOCK|PG_TERMINATE_BACKEND|PG_CANCEL_BACKEND)\s*\(/.test(statement)) invalid();
  }
}
