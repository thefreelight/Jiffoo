/**
 * Gateway Metrics Tests (Task 2.6.2)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { gatewayMetrics } from '@/core/admin/extension-installer/gateway-metrics';

describe('Gateway Metrics (Task 2.6.2)', () => {
  beforeEach(() => {
    gatewayMetrics.reset();
  });

  it('records request counters by slug and status', () => {
    gatewayMetrics.recordRequest('plugin-a', 200, 50);
    gatewayMetrics.recordRequest('plugin-a', 200, 30);
    gatewayMetrics.recordRequest('plugin-a', 500, 100);

    const snap = gatewayMetrics.snapshot();
    expect(snap.requestsTotal.get('plugin-a|200')).toBe(2);
    expect(snap.requestsTotal.get('plugin-a|500')).toBe(1);
  });

  it('records duration samples per slug', () => {
    gatewayMetrics.recordRequest('plugin-b', 200, 50);
    gatewayMetrics.recordRequest('plugin-b', 200, 150);

    const snap = gatewayMetrics.snapshot();
    const durations = snap.durationBuckets.get('plugin-b');
    expect(durations).toBeDefined();
    expect(durations!.length).toBe(2);
    expect(durations).toContain(50);
    expect(durations).toContain(150);
  });

  it('records breaker states', () => {
    gatewayMetrics.recordBreakerState('plugin-c', 'open');
    const snap = gatewayMetrics.snapshot();
    expect(snap.breakerStates.get('plugin-c')).toBe('open');
  });

  it('exports Prometheus format', () => {
    gatewayMetrics.recordRequest('plugin-d', 200, 100);
    gatewayMetrics.recordBreakerState('plugin-d', 'closed');

    const prom = gatewayMetrics.toPrometheus();
    expect(prom).toContain('plugin_gateway_requests_total');
    expect(prom).toContain('plugin-d');
    expect(prom).toContain('plugin_gateway_duration_seconds');
    expect(prom).toContain('plugin_gateway_breaker_state');
  });

  it('reset clears all metrics', () => {
    gatewayMetrics.recordRequest('plugin-e', 200, 50);
    gatewayMetrics.recordBreakerState('plugin-e', 'open');

    gatewayMetrics.reset();

    const snap = gatewayMetrics.snapshot();
    expect(snap.requestsTotal.size).toBe(0);
    expect(snap.durationBuckets.size).toBe(0);
    expect(snap.breakerStates.size).toBe(0);
  });

  it('tracks trustLevel in recordRequest (for audit logging)', () => {
    gatewayMetrics.recordRequest('plugin-f', 200, 50, 'official');
    // The trustLevel is passed through — we just verify it doesn't throw
    const snap = gatewayMetrics.snapshot();
    expect(snap.requestsTotal.get('plugin-f|200')).toBe(1);
  });
});
