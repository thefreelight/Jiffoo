import { createRequire } from 'node:module';

export async function resetTestPluginSchemas(databaseUrl) {
  const url = new URL(databaseUrl);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || decodeURIComponent(url.pathname.slice(1)) !== 'jiffoo_core_test') {
    throw new Error('GUARD failed: plugin schema reset requires exactly jiffoo_core_test.');
  }
  for (const parameter of ['schema', 'connection_limit', 'pool_timeout']) url.searchParams.delete(parameter);
  const require = createRequire(new URL('../apps/api/package.json', import.meta.url));
  const { Client } = require('pg');
  const client = new Client({ connectionString: url.toString() });
  try {
    await client.connect();
    const database = await client.query('SELECT current_database() AS name');
    if (database.rows[0].name !== 'jiffoo_core_test') throw new Error('GUARD failed: connected database is not jiffoo_core_test.');
    await client.query('BEGIN');
    const schemas = await client.query("SELECT nspname FROM pg_namespace WHERE left(nspname, 7) = 'plugin_' ORDER BY nspname");
    for (const { nspname } of schemas.rows) {
      await client.query(`DROP SCHEMA "${nspname.replaceAll('"', '""')}" CASCADE`);
    }
    const remaining = await client.query("SELECT count(*)::int AS count FROM pg_namespace WHERE left(nspname, 7) = 'plugin_'");
    if (remaining.rows[0].count !== 0) throw new Error('Plugin schema reset left plugin schemas behind.');
    await client.query('COMMIT');
    console.log(`Test plugin schema reset: dropped ${schemas.rows.length}; remaining plugin schemas 0; unclaimed plugin schemas 0 (database jiffoo_core_test).`);
  } finally {
    await client.end();
  }
}
