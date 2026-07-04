/**
 * i18n plugin - Prisma migration test
 *
 * Verifies that all migrations have been applied and the database
 * schema matches the Prisma schema (no drift).
 */

import { loadEnvFile } from '../../../../../tests/shared/load-env';
import path from 'path';
loadEnvFile(path.resolve(__dirname, '../../../../../.env.test'));

import { execSync } from 'child_process';
import { describe, it, expect } from 'vitest';

const SCHEMA_PATH = path.resolve(__dirname, '../../prisma/schema.prisma');
const CWD = path.resolve(__dirname, '../../');

describe('i18n Prisma Migrations', () => {
  it('should have no pending migrations', () => {
    const output = execSync(
      `pnpm exec prisma migrate status --schema "${SCHEMA_PATH}"`,
      {
        cwd: CWD,
        env: { ...process.env },
        encoding: 'utf-8',
        timeout: 30000,
      }
    );

    expect(output).toContain('Database schema is up to date');
  });

  it('should have no schema drift', () => {
    const output = execSync(
      `pnpm exec prisma migrate diff --from-schema-datasource "${SCHEMA_PATH}" --to-schema-datamodel "${SCHEMA_PATH}" --exit-code`,
      {
        cwd: CWD,
        env: { ...process.env },
        encoding: 'utf-8',
        timeout: 30000,
      }
    );

    expect(output).toContain('No difference detected');
  });
});
