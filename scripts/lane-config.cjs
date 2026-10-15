// Single specification shared by ESM verification scripts and CommonJS API test controls.
const registry = Object.freeze({ plugins: 13, orders: 12, storefront: 11 });

function laneConfig(laneId = process.env.LANE_ID) {
  laneId ||= '';
  if (laneId && (!/^[a-z][a-z0-9]{0,15}$/.test(laneId) || !Object.hasOwn(registry, laneId))) {
    throw new Error('LANE_ID must identify a registered lane.');
  }
  return Object.freeze({ laneId, databaseName: `jiffoo_core_test${laneId ? `_${laneId}` : ''}`, apiRedisDb: laneId ? registry[laneId] : 15, e2eRedisDb: laneId ? undefined : 14 });
}

function localUrl(value, protocols) {
  const url = new URL(value);
  if (!protocols.includes(url.protocol) || !['localhost', '127.0.0.1', '[::1]', '::1'].includes(url.hostname) || url.hash) {
    throw new Error('Test service URL must use the expected protocol and a local host.');
  }
  const text = String(value);
  const pathStart = text.indexOf('/', text.indexOf('://') + 3);
  const rawPath = pathStart < 0 ? '' : text.slice(pathStart).split(/[?#]/, 1)[0];
  if (decodeURIComponent(rawPath) !== decodeURIComponent(url.pathname)) throw new Error('Test service URL contains a normalized path trick.');
  return url;
}

function validateDatabaseUrl(value, config = laneConfig()) {
  const url = localUrl(value, ['postgres:', 'postgresql:']);
  const name = decodeURIComponent(url.pathname.slice(1));
  if (!/^jiffoo_core_test(?:_[a-z][a-z0-9]{0,15})?$/.test(name) || name !== config.databaseName) {
    throw new Error(`Test database must be exactly ${config.databaseName}.`);
  }
  // Allow only non-routing parameters. A single timezone setting cannot change the target
  // database; arbitrary libpq options, dbname and host overrides remain forbidden.
  for (const [key, value] of url.searchParams) {
    if (key === 'options' && /^-c timezone=[A-Za-z0-9_+/-]+$/.exec(value)?.[0] === value) continue;
    if (!['schema', 'connection_limit', 'pool_timeout', 'connect_timeout', 'sslmode', 'application_name'].includes(key)) {
      throw new Error(`Unexpected test database URL parameter: ${key}`);
    }
  }
  return url;
}

function assertIntegrationE2e(config = laneConfig()) {
  if (config.laneId) throw new Error('Lane E2E runs in CI only; unset LANE_ID in the integration worktree.');
}

function validateRedisUrl(value, config = laneConfig(), e2e = false) {
  if (e2e) assertIntegrationE2e(config);
  const url = localUrl(value, ['redis:', 'rediss:']);
  const expected = e2e ? config.e2eRedisDb : config.apiRedisDb;
  if (url.pathname !== `/${expected}` || url.search) throw new Error(`Test Redis must use logical DB ${expected}.`);
  return url;
}

function assertCurrentDatabase(name, config = laneConfig()) {
  if (name !== config.databaseName) throw new Error(`Connected database must be exactly ${config.databaseName}.`);
}

module.exports = { registry, laneConfig, validateDatabaseUrl, validateRedisUrl, assertIntegrationE2e, assertCurrentDatabase };
