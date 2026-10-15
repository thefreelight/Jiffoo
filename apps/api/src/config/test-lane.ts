// Load test tooling only when a test control is invoked; production images do not contain scripts/.
type LaneConfig = { laneId: string; databaseName: string; apiRedisDb: number; e2eRedisDb?: number };
type Rules = {
  laneConfig: (laneId?: string) => LaneConfig;
  validateDatabaseUrl: (value: string, config?: LaneConfig) => URL;
  validateRedisUrl: (value: string, config?: LaneConfig, e2e?: boolean) => URL;
  assertIntegrationE2e: (config?: LaneConfig) => void;
  assertCurrentDatabase: (name: string, config?: LaneConfig) => void;
};
const rules = (): Rules => require('../../../../scripts/lane-config.cjs');

export const laneConfig = (laneId?: string): LaneConfig => rules().laneConfig(laneId);
export const validateDatabaseUrl = (value: string, config?: LaneConfig): URL => rules().validateDatabaseUrl(value, config);
export const validateRedisUrl = (value: string, config?: LaneConfig, e2e?: boolean): URL => rules().validateRedisUrl(value, config, e2e);
export const assertIntegrationE2e = (config?: LaneConfig): void => rules().assertIntegrationE2e(config);
export const assertCurrentDatabase = (name: string, config?: LaneConfig): void => rules().assertCurrentDatabase(name, config);
