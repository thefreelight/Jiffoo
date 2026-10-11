import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const require = createRequire('/app/apps/api/package.json');
const { Client } = require('pg');
assert.equal(new URL(process.env.DATABASE_URL).pathname, '/jiffoo_core_test');
const client = new Client({ connectionString: process.env.DATABASE_URL });
const mode = process.argv[2];
try {
  await client.connect();
  if (mode === 'managed') {
    const result = {};
    for (const [table, filter] of [
      ['plugin_installs', "WHERE source='builtin'"], ['plugin_installations', "WHERE \"pluginSlug\" IN (SELECT slug FROM public.plugin_installs WHERE source='builtin')"],
      ['plugin_event_subscriptions', "WHERE \"pluginSlug\" IN (SELECT slug FROM public.plugin_installs WHERE source='builtin')"], ['plugin_package_blobs', "WHERE \"pluginSlug\" IN (SELECT slug FROM public.plugin_installs WHERE source='builtin')"],
      ['themes', "WHERE source='builtin'"], ['theme_configurations', ''], ['theme_config_revisions', ''], ['theme_package_blobs', ''], ['theme_active', ''],
    ]) {
      const rows = (await client.query(`SELECT row_to_json(t)::text AS row FROM public."${table}" t ${filter}`)).rows.map(row => row.row).sort();
      result[table] = createHash('sha256').update(JSON.stringify(rows)).digest('hex');
    }
    result.registry = (await client.query('SELECT "pluginRegistryVersion" FROM public.system_settings WHERE id=$1', ['system'])).rows[0].pluginRegistryVersion;
    result.pluginVersion = (await client.query('SELECT version FROM public.plugin_installs WHERE slug=$1', ['free-shipping'])).rows[0].version;
    result.themeVersion = (await client.query('SELECT version FROM public.themes WHERE slug=$1', ['default-shop'])).rows[0].version;
    console.info('UPDATE_MANAGED ' + JSON.stringify(result));
  } else if (mode === 'configure') {
    const password = process.argv[3];
    const login = await fetch('http://api-1:3001/api/v1/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'update-owner@example.test', password }) });
    assert.equal(login.status, 200);
    const token = (await login.json()).data.access_token;
    const response = await fetch('http://api-1:3001/api/v1/extensions/themes/default-shop/config', { method: 'PUT', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token }, body: JSON.stringify({ expectedRevision: 0, values: {} }) });
    assert.equal(response.status, 200, await response.text());
  } else throw new Error('Unknown update fixture mode');
} finally { await client.end(); }
