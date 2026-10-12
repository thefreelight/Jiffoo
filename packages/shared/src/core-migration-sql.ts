import { tokenizeMigrationSql } from './plugin-migrations';

/** Core SQL owns no transaction boundaries; the host executor owns the transaction. */
export function validateCoreMigrationSql(sql: string): { sql: string; wrapperStripped: boolean } {
  const invalid = (): never => { throw new Error('Core migration SQL is not transaction-safe'); };
  const tokens = tokenizeMigrationSql(sql, invalid, true);
  const statements = [...tokens.matchAll(/[^;]+(?:;|$)/g)].filter(match => match[0].replace(/;$/, '').trim());
  const first = statements[0], last = statements[statements.length - 1];
  const wrapperStripped = Boolean(first && last && statements.length >= 3
    && /^(BEGIN|START\s+TRANSACTION)\s*;$/i.test(first[0].trim())
    && /^(COMMIT|END)\s*;$/i.test(last[0].trim()));
  const inner = wrapperStripped ? statements.slice(1, -1) : statements;
  for (const match of inner) {
    const statement = match[0].trim().toUpperCase();
    if (/^(BEGIN|START\s+TRANSACTION|COMMIT|END|ROLLBACK|ABORT|SAVEPOINT|RELEASE|VACUUM|CLUSTER)\b/.test(statement)
      || /^PREPARE\s+TRANSACTION\b/.test(statement)
      || /^(CREATE|DROP|ALTER)\s+(DATABASE|TABLESPACE|SUBSCRIPTION|SYSTEM)\b/.test(statement)
      || /\bCONCURRENTLY\b/.test(statement)
      || /^COPY\b[\s\S]*\b(STDIN|STDOUT|PROGRAM)\b/.test(statement)) invalid();
  }
  return { sql: wrapperStripped ? sql.slice(first!.index! + first![0].length, last!.index!) : sql, wrapperStripped };
}
