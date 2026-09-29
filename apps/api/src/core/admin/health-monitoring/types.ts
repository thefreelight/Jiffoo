/**
 * Admin health summary types.
 */

export type ComponentStatus = 'ok' | 'error';

export interface HealthSummaryResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  database: {
    status: ComponentStatus;
  };
  redis: {
    status: ComponentStatus;
  };
  pluginRuntime: {
    status: 'ok';
    loaded: number;
  };
  version: string;
  worker: {
    running: boolean;
    instances: number;
    lastBeatAt: string | null;
  };
  uptime: number;
}
