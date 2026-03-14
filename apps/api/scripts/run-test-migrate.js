const { spawnSync } = require('node:child_process');

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: process.env,
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function assertSafeTestDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL_TEST || process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL_TEST is required for test migration.');
  }

  if (!/(^|[_-])test([^a-zA-Z0-9]|$)/i.test(databaseUrl)) {
    throw new Error(`Unsafe test database URL detected: ${databaseUrl}`);
  }

  process.env.DATABASE_URL_TEST = databaseUrl;
  process.env.DATABASE_URL = databaseUrl;
}

function main() {
  assertSafeTestDatabaseUrl();
  run('npx', ['prisma', 'migrate', 'deploy']);
}

main();
