/**
 * Plugin Gateway Metrics (Task 2.6.2)
 *
 * Provides metrics for the plugin gateway. These are designed to be exposed
 * via the `/metrics` Prometheus endpoint (task 5.3) or any other metrics
 * registry. Until R5 (observability) is fully landed, this module provides
 * a simple in-memory counter/histogram implementation with a registration
 * interface that can be swapped out.
 *
 * Metrics:
 * - `plugin_gateway_requests_total{slug,status}` — counter
 * - `plugin_gateway_duration_seconds{slug}` — histogram
 * - `plugin_gateway_breaker_state{slug,state}` — gauge
 */

// ============================================================================
// Types
// ============================================================================

export interface GatewayMetricsSnapshot {
  requestsTotal: Map<string, number>; // key: "slug|status"
  durationBuckets: Map<string, number[]>; // key: slug, value: durations in ms
  breakerStates: Map<string, string>; // key: slug, value: state
}

// ============================================================================
// Metrics Registry
// ============================================================================

class GatewayMetricsRegistry {
  private requestsTotal = new Map<string, number>();
  private durationBuckets = new Map<string, number[]>();
  private breakerStates = new Map<string, string>();

  /** Histogram buckets in milliseconds (Prometheus-style) */
  private readonly durationBucketMs = [10, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 30000];

  /**
   * Record a gateway request.
   *
   * @param slug - Plugin slug
   * @param status - HTTP status code
   * @param durationMs - Request duration in milliseconds
   * @param trustLevel - Plugin trust level
   */
  recordRequest(
    slug: string,
    status: number,
    durationMs: number,
    trustLevel?: string,
  ): void {
    // Counter
    const key = `${slug}|${status}`;
    this.requestsTotal.set(key, (this.requestsTotal.get(key) || 0) + 1);

    // Histogram
    const durations = this.durationBuckets.get(slug) || [];
    durations.push(durationMs);
    // Keep last 1000 samples per slug to prevent memory growth
    if (durations.length > 1000) {
      durations.shift();
    }
    this.durationBuckets.set(slug, durations);
  }

  /**
   * Update the breaker state gauge for a plugin.
   */
  recordBreakerState(slug: string, state: string): void {
    this.breakerStates.set(slug, state);
  }

  /**
   * Get a snapshot of all metrics (for Prometheus export or testing).
   */
  snapshot(): GatewayMetricsSnapshot {
    return {
      requestsTotal: new Map(this.requestsTotal),
      durationBuckets: new Map(this.durationBuckets),
      breakerStates: new Map(this.breakerStates),
    };
  }

  /**
   * Export metrics in Prometheus text format.
   */
  toPrometheus(): string {
    const lines: string[] = [];

    // Requests total
    lines.push('# HELP plugin_gateway_requests_total Total plugin gateway requests by slug and status');
    lines.push('# TYPE plugin_gateway_requests_total counter');
    for (const [key, count] of this.requestsTotal) {
      const [slug, status] = key.split('|');
      lines.push(`plugin_gateway_requests_total{slug="${slug}",status="${status}"} ${count}`);
    }

    // Duration histogram
    lines.push('# HELP plugin_gateway_duration_seconds Plugin gateway request duration');
    lines.push('# TYPE plugin_gateway_duration_seconds histogram');
    for (const [slug, durations] of this.durationBuckets) {
      const sortedDurations = [...durations].sort((a, b) => a - b);
      for (const bucketMs of this.durationBucketMs) {
        const count = sortedDurations.filter((d) => d <= bucketMs).length;
        lines.push(
          `plugin_gateway_duration_seconds_bucket{slug="${slug}",le="${(bucketMs / 1000).toFixed(3)}"} ${count}`,
        );
      }
      lines.push(
        `plugin_gateway_duration_seconds_bucket{slug="${slug}",le="+Inf"} ${sortedDurations.length}`,
      );
      lines.push(`plugin_gateway_duration_seconds_count{slug="${slug}"} ${sortedDurations.length}`);

      const sum = sortedDurations.reduce((a, b) => a + b, 0);
      lines.push(`plugin_gateway_duration_seconds_sum{slug="${slug}"} ${(sum / 1000).toFixed(3)}`);
    }

    // Breaker state
    lines.push('# HELP plugin_gateway_breaker_state Plugin gateway circuit breaker state (0=closed, 1=open, 2=half-open)');
    lines.push('# TYPE plugin_gateway_breaker_state gauge');
    const stateMap: Record<string, number> = { closed: 0, open: 1, 'half-open': 2 };
    for (const [slug, state] of this.breakerStates) {
      lines.push(`plugin_gateway_breaker_state{slug="${slug}"} ${stateMap[state] ?? 0}`);
    }

    return lines.join('\n') + '\n';
  }

  /**
   * Reset all metrics (useful for testing).
   */
  reset(): void {
    this.requestsTotal.clear();
    this.durationBuckets.clear();
    this.breakerStates.clear();
  }
}

/** Singleton metrics registry */
export const gatewayMetrics = new GatewayMetricsRegistry();
