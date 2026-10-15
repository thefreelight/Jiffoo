import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { laneConfig, validateDatabaseUrl } from './lane-config.mjs';

export function provisionPlan(env = process.env, args = []) {
  const config = laneConfig(env.LANE_ID);
  if (!config.laneId) throw new Error('Provisioning requires a registered LANE_ID.');
  if (args.some(arg => arg !== '--apply') || args.length > 1) throw new Error('Only --apply is accepted; provisioning only permits CREATE DATABASE.');
  const url = validateDatabaseUrl(env.DATABASE_URL_TEST, config);
  url.pathname = '/postgres';
  url.search = '';
  return { databaseName: config.databaseName, maintenanceUrl: url.toString(), apply: args.includes('--apply'), sql: `CREATE DATABASE "${config.databaseName}"` };
}

export async function provisionLane(plan, createClient, log = console.log) {
  // Revalidate every executable plan, including injected callers; no arbitrary SQL is accepted.
  const config = laneConfig(plan.databaseName?.replace(/^jiffoo_core_test_/, ''));
  if (!config.laneId || plan.sql !== `CREATE DATABASE "${config.databaseName}"`) throw new Error('Only the validated CREATE DATABASE statement is permitted.');
  const base = new URL(plan.maintenanceUrl);
  base.pathname = `/${config.databaseName}`;
  validateDatabaseUrl(base.toString(), config);
  if (new URL(plan.maintenanceUrl).pathname !== '/postgres') throw new Error('Maintenance database must be postgres.');
  if (!plan.apply) {
    log(`DRY RUN: connect to local PostgreSQL maintenance database postgres; create ${plan.databaseName} only if absent.`);
    log(`DRY RUN: ${plan.sql}`);
    return;
  }
  const client = createClient(plan.maintenanceUrl);
  try {
    await client.connect();
    const existing = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [config.databaseName]);
    if (!existing.rows.length) await client.query(plan.sql);
  } finally { await client.end(); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const plan = provisionPlan(process.env, process.argv.slice(2));
  await provisionLane(plan, url => {
    const require = createRequire(new URL('../apps/api/package.json', import.meta.url));
    return new (require('pg').Client)({ connectionString: url });
  });
}
