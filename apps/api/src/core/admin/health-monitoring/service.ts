/**
 * Admin health summary service.
 */

import { getPluginRuntimeState } from '@/core/admin/extension-installer/plugin-runtime';
import { performHealthCheck } from '@/utils/health-check';
import type { HealthSummaryResponse } from './types';

export class HealthMonitoringService {
  static async getHealthSummary(): Promise<HealthSummaryResponse> {
    const [healthCheck, pluginRuntime] = await Promise.all([
      performHealthCheck(),
      Promise.resolve(getPluginRuntimeState()),
    ]);

    const database = { status: healthCheck.checks.database.status };
    const redis = { status: healthCheck.checks.redis.status };
    const status = database.status === 'error'
      ? 'unhealthy'
      : redis.status === 'error'
        ? 'degraded'
        : 'healthy';

    return {
      status,
      database,
      redis,
      pluginRuntime: {
        status: 'ok',
        loaded: pluginRuntime.loaded,
      },
      version: healthCheck.version,
      uptime: healthCheck.uptime_seconds,
    };
  }
}
