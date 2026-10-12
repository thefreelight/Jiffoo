import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
assert.equal(process.env.DATABASE_URL_TEST, 'postgresql://postgres:postgres@localhost:5432/jiffoo_core_test');
assert.equal(new URL(process.env.DATABASE_URL).pathname, '/jiffoo_core_test');
const { Client } = createRequire('/app/apps/api/package.json')('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
try {
  await client.connect();
  const rows = (await client.query('SELECT "actorId",action,"targetId",summary FROM public.admin_audit_events WHERE action IN (\'CORE_UPDATE\',\'CORE_RESTORE\') ORDER BY "createdAt",id')).rows;
  console.log('HOST_AUDITS ' + JSON.stringify(rows));
} finally { await client.end(); }
