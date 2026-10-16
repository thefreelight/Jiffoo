import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateStorageSecret } from './storage-secret.mjs';

test('storage secrets retain all 48 random bytes and cannot become CLI flags', () => {
  const dangerous = Buffer.alloc(48, 0xf8);
  assert.ok(dangerous.toString('base64url').startsWith('-'));
  for (let first = 0; first <= 255; first++) {
    const bytes = Buffer.from(dangerous); bytes[0] = first;
    let calls = 0;
    const secret = generateStorageSecret(size => {
      assert.equal(size, 48); calls++; return bytes;
    });
    assert.equal(calls, 1);
    assert.match(secret, /^[A-Za-z0-9][A-Za-z0-9_-]{64}$/);
    assert.deepEqual(Buffer.from(secret.slice(1), 'base64url'), bytes);
  }
});

test('every deployment storage credential generator uses the safe secret source', () => {
  for (const file of ['verify-backup.mjs', 'verify-compose.mjs', 'verify-update.mjs']) {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8');
    assert.match(source, /import \{ generateStorageSecret \} from '\.\/storage-secret\.mjs';/);
    for (const key of ['MINIO_ROOT_PASSWORD', 'SILO_APP_SECRET_ACCESS_KEY'])
      assert.match(source, new RegExp(`${key}:\\s*generateStorageSecret\\(\\)`), `${file}: ${key}`);
  }
  const trial = readFileSync(new URL('local-trial.mjs', import.meta.url), 'utf8');
  assert.match(trial, /import \{ generateStorageSecret \} from '\.\/storage-secret\.mjs';/);
  assert.match(trial, /const secret = generateStorageSecret;/);
  for (const key of ['MINIO_ROOT_USER', 'MINIO_ROOT_PASSWORD', 'SILO_APP_ACCESS_KEY_ID', 'SILO_APP_SECRET_ACCESS_KEY'])
    assert.match(trial, new RegExp(`${key}: secret\\(\\)`));
});

test('Silo credentials follow an option terminator before any positional argument', () => {
  const source = readFileSync(new URL('../deploy/compose/silo-init.sh', import.meta.url), 'utf8');
  const commands = source.split(/\r?\n/).filter(line => /^mcli /.test(line));
  assert.equal(commands.filter(line => line.includes('$MINIO_ROOT_PASSWORD')).length, 1);
  assert.equal(commands.filter(line => line.includes('$UPLOAD_S3_SECRET_ACCESS_KEY')).length, 1);
  assert.ok(commands.includes('mcli alias set -- local http://silo:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null'));
  assert.ok(commands.includes('mcli admin user add -- local "$UPLOAD_S3_ACCESS_KEY_ID" "$UPLOAD_S3_SECRET_ACCESS_KEY" >/dev/null'));
  assert.ok(commands.includes('mcli admin policy attach --user="$UPLOAD_S3_ACCESS_KEY_ID" -- local "$policy" >/dev/null'));
  assert.match(source, /^#!\/bin\/sh\r?\nset -eu\r?\n/);
});
