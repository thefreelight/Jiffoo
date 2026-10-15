import { createRequire } from 'node:module';
import { validateDatabaseUrl, assertCurrentDatabase, laneConfig } from './lane-config.mjs';

export async function resetTestPluginSchemas(databaseUrl) {
  const url = validateDatabaseUrl(databaseUrl);
  for (const parameter of ['schema', 'connection_limit', 'pool_timeout']) url.searchParams.delete(parameter);
  const require = createRequire(new URL('../apps/api/package.json', import.meta.url));
  const { Client } = require('pg');
  const client = new Client({ connectionString: url.toString() });
  try {
    await client.connect();
    const database = await client.query('SELECT current_database() AS name');
    assertCurrentDatabase(database.rows[0].name);
    await client.query('BEGIN');
    const schemas = await client.query("SELECT nspname FROM pg_namespace WHERE left(nspname, 7) = 'plugin_' ORDER BY nspname");
    for (const { nspname } of schemas.rows) {
      await client.query(`DROP SCHEMA "${nspname.replaceAll('"', '""')}" CASCADE`);
    }
    const remaining = await client.query("SELECT count(*)::int AS count FROM pg_namespace WHERE left(nspname, 7) = 'plugin_'");
    if (remaining.rows[0].count !== 0) throw new Error('Plugin schema reset left plugin schemas behind.');
    await client.query('COMMIT');
    console.log(`Test plugin schema reset: dropped ${schemas.rows.length}; remaining plugin schemas 0; unclaimed plugin schemas 0 (database ${laneConfig().databaseName}).`);
  } finally {
    await client.end();
  }
}
