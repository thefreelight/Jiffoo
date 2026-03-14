import { describe, it, expect } from 'vitest';
import { MetricsCollector, collectSystemMetrics } from './metrics-collector';

describe('MetricsCollector', () => {
  it('should collect CPU metrics', async () => {
    const collector = new MetricsCollector();
    const cpuMetrics = await collector.collectCpuMetrics();

    expect(cpuMetrics.usage).toBeGreaterThanOrEqual(0);
    expect(cpuMetrics.usage).toBeLessThanOrEqual(100);
    expect(cpuMetrics.cores).toBeGreaterThan(0);
    expect(cpuMetrics.model).toBeDefined();
  });

  it('should collect memory metrics', async () => {
    const collector = new MetricsCollector();
    const memoryMetrics = await collector.collectMemoryMetrics();

    expect(memoryMetrics.total).toBeGreaterThan(0);
    expect(memoryMetrics.used).toBeGreaterThanOrEqual(0);
    expect(memoryMetrics.free).toBeGreaterThanOrEqual(0);
    expect(memoryMetrics.usage).toBeGreaterThanOrEqual(0);
    expect(memoryMetrics.usage).toBeLessThanOrEqual(100);
  });

  it('should collect all metrics', async () => {
    const metrics = await collectSystemMetrics();

    expect(metrics.cpu).toBeDefined();
    expect(metrics.memory).toBeDefined();
    expect(metrics.timestamp).toBeDefined();
    expect(metrics.uptime).toBeGreaterThan(0);
  });
});
