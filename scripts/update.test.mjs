import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assertNoMigrations, durableJson } from '../deploy/release/update.mjs';
import { updateProfile, guardUpdateDatabase } from './verify-update.mjs';

test('no-migration gate rejects pending changed extra failed and rolled-back history', () => {
  const target = [{ name: '001', checksum: 'a' }, { name: '002', checksum: 'b' }];
  const history = target.map(row => ({ migration_name: row.name, checksum: row.checksum, finished_at: '2026-10-11', rolled_back_at: null }));
  assertNoMigrations(history, target);
  assert.throws(() => assertNoMigrations(history.slice(0,1), target), /migration-capable/);
  for (const mutation of [rows => rows.reverse(), rows => rows[0].checksum = 'edited', rows => rows[0].finished_at = null, rows => rows[0].rolled_back_at = 'now', rows => rows.push(rows[0])]) {
    const rows = structuredClone(history); mutation(rows); assert.throws(() => assertNoMigrations(rows, target), /mismatch/);
  }
});
test('profiles and database guard cannot silently select a different gate or database', () => {
  assert.equal(updateProfile([]),'core'); assert.equal(updateProfile(['--profile=full']),'full');
  for(const args of [['--profile=unknown'],['--profile=core','--extra']])assert.throws(()=>updateProfile(args));
  guardUpdateDatabase('postgresql://postgres:postgres@localhost:5432/jiffoo_core_test');
  for(const url of [undefined,'postgresql://postgres:postgres@localhost:5432/jiffoo_core','postgresql://postgres:postgres@remote:5432/jiffoo_core_test'])assert.throws(()=>guardUpdateDatabase(url));
});
test('journal replacement preserves one complete durable record', { skip: process.platform === 'win32' }, () => {
  const directory=mkdtempSync(join(tmpdir(),'jiffoo-journal-'));
  try {const path=join(directory,'journal.json');durableJson(path,{phase:'prepared'});durableJson(path,{phase:'maintenance',operation:'same'});assert.deepEqual(JSON.parse(readFileSync(path)),{phase:'maintenance',operation:'same'});}finally{rmSync(directory,{recursive:true,force:true});}
});
