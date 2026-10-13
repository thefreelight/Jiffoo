import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assertNoMigrations, durableJson, planDigest, installedBindings } from '../deploy/release/update.mjs';
import { updateProfile, guardUpdateDatabase, updateStep, bumpThemePatch } from './verify-update.mjs';
import { ciSteps } from './verify-steps.mjs';

test('theme update fixtures advance the current manifest patch across major versions', () => {
  for (const [current, expected] of [['1.1.0', '1.1.1'], ['2.0.0', '2.0.1'], ['3.7.9', '3.7.10']])
    assert.equal(bumpThemePatch(current), expected);
  for (const version of ['2.0', '2.0.0-beta', '02.0.0', '2.0.9007199254740991'])
    assert.throws(() => bumpThemePatch(version));
});

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
  assert.equal(updateProfile(['--profile=core','--partition=no-migration']),'core');
  assert.equal(updateProfile(['--partition=migration','--profile=core']),'core');
  for(const args of [['--partition=unknown'],['--partition=migration','--partition=no-migration'],['--profile=full','--partition=migration']])assert.throws(()=>updateProfile(args));
  for(const args of [['--profile=unknown'],['--profile=core','--extra']])assert.throws(()=>updateProfile(args));
  guardUpdateDatabase('postgresql://postgres:postgres@localhost:5432/jiffoo_core_test');
  for(const url of [undefined,'postgresql://postgres:postgres@localhost:5432/jiffoo_core','postgresql://postgres:postgres@remote:5432/jiffoo_core_test'])assert.throws(()=>guardUpdateDatabase(url));
});
test('journal replacement preserves one complete durable record', { skip: process.platform === 'win32' }, () => {
  const directory=mkdtempSync(join(tmpdir(),'jiffoo-journal-'));
  try {const path=join(directory,'journal.json');durableJson(path,{phase:'prepared'});durableJson(path,{phase:'maintenance',operation:'same'});assert.deepEqual(JSON.parse(readFileSync(path)),{phase:'maintenance',operation:'same'});}finally{rmSync(directory,{recursive:true,force:true});}
});
test('plan confirmation ignores only volatile state and preserves ordered migration identities', () => {
  const plan={version:2,paths:{current:'/old',target:'/new',state:'/state',backup:'/backup',actor:'owner',token:'volatile'},boots:[{state:'LIVE'}],migrations:[{name:'001',checksum:'a'},{name:'002',checksum:'b'}]};
  const digest=planDigest(plan);
  assert.equal(planDigest({...plan,boots:[],paths:{...plan.paths,token:'other',confirmation:digest}}),digest);
  assert.notEqual(planDigest({...plan,migrations:[...plan.migrations].reverse()}),digest);
  assert.notEqual(planDigest({...plan,paths:{...plan.paths,backup:'/other'}}),digest);
});
test('restored resource bindings remain authoritative and foreign or conflicting volumes are refused',()=>{
  const config={services:{postgres:{volumes:[{type:'volume',source:'postgres-data',target:'/pg'}]}},volumes:{'postgres-data':{name:'project_postgres-data'}}};
  const containers=[{Config:{Labels:{'com.docker.compose.service':'postgres'}},Mounts:[{Type:'volume',Name:'project-restore-postgres-data',Destination:'/pg'}]}];
  const volumes=[{Name:'project-restore-postgres-data',Driver:'local',Options:null,Labels:{'com.docker.compose.project':'project','com.docker.compose.volume':'postgres-data'}}];
  assert.deepEqual(installedBindings(config,containers,volumes,'project'),{volumes:{'postgres-data':'project-restore-postgres-data'},tls:{}});
  assert.throws(()=>installedBindings(config,containers,volumes,'foreign'),/Unowned/);
  assert.throws(()=>installedBindings(config,containers,[],'project'),/Unowned/);
});
test('the emitted update artifact agrees with the existing CI step catalogue',()=>{
  const previous=process.env.GITHUB_ACTIONS;process.env.GITHUB_ACTIONS='true';
  try {
    assert.equal(updateStep,ciSteps('postgresql://postgres:postgres@localhost:5432/jiffoo_core_test','update-no-migration')[0][0]);
    assert.equal('Run migration update acceptance',ciSteps('postgresql://postgres:postgres@localhost:5432/jiffoo_core_test','update-migration')[0][0]);
  }
  finally { if(previous===undefined)delete process.env.GITHUB_ACTIONS;else process.env.GITHUB_ACTIONS=previous; }
});
