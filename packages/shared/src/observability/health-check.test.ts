import { describe, it, expect } from 'vitest';
import { HealthCheckService, HealthStatus, createRedisCacheStatsCheck } from './health-check';

describe('HealthCheckService Metrics', () => {
  it('should record metrics for health checks', async () => {
    const service = new HealthCheckService({ enableMetrics: true });

    service.registerCheck('test', async () => ({
      name: 'test',
      status: HealthStatus.HEALTHY,
      message: 'OK'
    }));

    await service.checkAll();
    const metrics = service.getCheckMetrics('test');

    expect(metrics).toBeDefined();
    expect(metrics?.totalCalls).toBe(1);
    expect(metrics?.successCount).toBe(1);
    expect(metrics?.errorCount).toBe(0);
  });

  it('should calculate error rate correctly', async () => {
    const service = new HealthCheckService({ enableMetrics: true });

    service.registerCheck('failing', async () => ({
      name: 'failing',
      status: HealthStatus.UNHEALTHY,
      message: 'Failed'
    }));

    await service.checkAll();
    await service.checkAll();

    const metrics = service.getCheckMetrics('failing');
    expect(metrics?.errorRate).toBe(100);
  });
});

describe('RedisCacheStatsCheck', () => {
  it('should evaluate cache health based on hit rate', async () => {
    const checkLowHitRate = createRedisCacheStatsCheck('cache', async () => ({
      hitRate: 30,  // Below 50% threshold
      missRate: 70,
    }));

    const result = await checkLowHitRate();
    expect(result.status).toBe(HealthStatus.DEGRADED);
  });

  it('should be healthy with good hit rate', async () => {
    const checkGoodHitRate = createRedisCacheStatsCheck('cache', async () => ({
      hitRate: 80,
      missRate: 20,
    }));

    const result = await checkGoodHitRate();
    expect(result.status).toBe(HealthStatus.HEALTHY);
  });
});
