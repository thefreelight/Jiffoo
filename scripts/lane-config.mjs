// The CJS implementation is also consumed synchronously by API test controls.
import rules from './lane-config.cjs';
export const { registry, laneConfig, validateDatabaseUrl, validateRedisUrl, assertIntegrationE2e, assertCurrentDatabase } = rules;
