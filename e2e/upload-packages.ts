import { promises as fs } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { issuePublisherCertificate } from '../packages/shared/src/plugin-signing';
import { testRoot, testPublisher } from '../apps/api/tests/fixtures/plugin-signing-keys';

export async function uploadPackages() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'jiffoo-upload-e2e-'));
  const certificate = path.join(root, 'certificate.json'), key = path.join(root, 'publisher.pem');
  await fs.writeFile(certificate, JSON.stringify(issuePublisherCertificate('e2e-upload-publisher', 'E2E Upload Publisher', testPublisher.publicKey, testRoot.privateKey)));
  await fs.writeFile(key, testPublisher.privateKey);
  const command = (args: string[]) => {
    const result = spawnSync(process.execPath, [path.resolve('packages/plugin-sdk/dist/cli.js'), ...args], { env: process.env, encoding: 'utf8', windowsHide: true });
    if (result.status !== 0) throw new Error(`SDK failed: ${result.stdout}${result.stderr}`);
  };
  const make = async (slug: string, name: string, version: string, signed: boolean, sql: string[] = []) => {
    const source = path.join(root, `${slug}-${version}`); await fs.cp(path.resolve('apps/api/builtin-plugins/free-shipping'), source, { recursive: true });
    const manifestPath = path.join(source, 'manifest.json'), manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
    Object.assign(manifest, { slug, name, version }); await fs.writeFile(manifestPath, JSON.stringify(manifest));
    if (sql.length) {
      await fs.mkdir(path.join(source, 'migrations'));
      manifest.database = { apiVersion: 1, migrations: sql.map((text, index) => ({ id: `step-${index + 1}`, order: index + 1, path: `migrations/00${index + 1}.sql`, sha256: createHash('sha256').update(Buffer.from(text)).digest('hex') })) };
      for (const [index, text] of sql.entries()) await fs.writeFile(path.join(source, `migrations/00${index + 1}.sql`), text, 'utf8');
      await fs.writeFile(manifestPath, JSON.stringify(manifest));
    }
    const unsigned = path.join(root, `${slug}-${version}-unsigned.zip`), output = path.join(root, `${slug}-${version}-signed.zip`);
    command(['pack', '--input', source, '--output', unsigned]);
    if (!signed) return unsigned;
    command(['sign', '--input', unsigned, '--certificate', certificate, '--key', key, '--output', output]); return output;
  };
  return { unsigned: await make('e2e-upload-unsigned', 'E2E Upload Unsigned', '1.0.0', false),
    signedV1: await make('e2e-upload-signed', 'E2E Upload Signed', '1.0.0', true), signedV2: await make('e2e-upload-signed', 'E2E Upload Signed', '2.0.0', true),
    migrationSuccess: await make('e2e-upload-migration', 'E2E Migration Success', '1.0.0', true, ['CREATE TABLE records (id INTEGER PRIMARY KEY); INSERT INTO records VALUES (1);', 'SELECT pg_advisory_xact_lock(985306::bigint); INSERT INTO records VALUES (2);']),
    migrationRetry: await make('e2e-upload-migration-retry', 'E2E Migration Retry', '1.0.0', true, ['CREATE TABLE records (id INTEGER PRIMARY KEY, value TEXT NOT NULL); CREATE TABLE gate (value TEXT); INSERT INTO gate VALUES (NULL); INSERT INTO records VALUES (1, \'first\');', 'INSERT INTO records VALUES (2, (SELECT value FROM gate));']),
    cleanup: () => fs.rm(root, { recursive: true, force: true }) };
}
