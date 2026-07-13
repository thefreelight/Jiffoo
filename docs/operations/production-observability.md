# Production Observability

Jiffoo ships with built-in OpenTelemetry tracing, Prometheus metrics, and default alerting rules. This guide covers setup, integration with external APMs, and common troubleshooting runbooks.

## Quick Start

### 1. Start the Observability Stack

```bash
docker compose -f deploy/observability/docker-compose.observability.yml up -d
```

This starts:
- **OpenTelemetry Collector** — receives traces and metrics
- **Prometheus** — scrapes and stores metrics
- **Tempo** — stores distributed traces
- **Grafana** — dashboards with pre-configured datasources

### 2. Configure the API

Set these environment variables on your API instance:

```env
# Enable OTel trace export (zero overhead if not set)
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318
OTEL_TRACES_SAMPLER_ARG=0.1

# Prometheus metrics (always available unless disabled)
OTEL_METRICS_DISABLED=false
PROMETHEUS_PORT=9091
```

### 3. Verify

- Metrics: `http://your-api-host:9091/metrics`
- Grafana: `http://localhost:3001` (admin/admin)
- Prometheus: `http://localhost:9090`

### 4. End-to-End Verification (Task 5.4.3)

After starting the observability stack and the API:

1. **Send test traffic**: `for i in $(seq 1 20); do curl -s http://localhost:3001/api/v1/products > /dev/null; done`
2. **Check Grafana dashboards**:
   - API Overview: should show request rate and latency
   - Job Queue: should show queue depth (0 if idle)
   - Plugin Gateway: should show breaker state (all closed)
3. **Verify traces**: Find a request `x-trace-id` header → open in Tempo → confirm fastify + prisma spans
4. **Trigger an alert**: Stop the API → wait 5 min → `APIHighErrorRate` alert fires in Prometheus

## Available Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `http_request_duration_seconds` | histogram | method, route, status | HTTP request latency |
| `http_requests_total` | counter | method, route, status | HTTP request count |
| `plugin_gateway_requests_total` | counter | slug, status | Plugin gateway calls |
| `plugin_gateway_duration_seconds` | histogram | slug | Plugin gateway latency |
| `plugin_gateway_breaker_state` | gauge | slug | Circuit breaker state (0=closed, 1=open, 2=half-open) |
| `jobs_queue_depth` | gauge | queue | Async job queue depth |
| `jobs_failed_total` | counter | queue | Failed job count |
| `jobs_duration_seconds` | histogram | queue | Job processing time |

## Alert Rules

Default alerts are defined in `deploy/observability/alerts.yml`:

| Alert | Condition | Severity |
|-------|-----------|----------|
| APIHighErrorRate | 5xx rate > 1% over 5min | critical |
| APIHighLatency | p95 latency > 2s over 5min | warning |
| PaymentFailureRate | Payment failure rate > 5% | critical |
| QueueBacklog | Queue depth > 1000 | warning |
| DBConnectionPoolHigh | Connection pool usage > 90% | critical |

## Integrating External APMs

### Datadog

Set the OTel exporter to your Datadog OTLP endpoint:

```env
OTEL_EXPORTER_OTLP_ENDPOINT=https://otlp.datadoghq.com
DD_API_KEY=your-datadog-api-key
```

### Grafana Cloud

```env
OTEL_EXPORTER_OTLP_ENDPOINT=https://otlp.grafana.net
OTEL_EXPORTER_OTLP_HEADERS=Authorization=Basic <base64-encoded-credentials>
```

## Slow Query Detection

Queries exceeding `SLOW_QUERY_MS` (default 500ms) are logged as structured warnings:

```json
{"level":"warn","event":"slow_query","model":"Order","action":"findMany","durationMs":1234}
```

Adjust the threshold:

```env
SLOW_QUERY_MS=1000
```

## Troubleshooting Runbooks

### API Becomes Slow

1. Check Grafana → API Overview dashboard for latency spikes
2. Look for slow query warnings in logs: `grep "slow_query" /var/log/jiffoo/api.log`
3. Check Prometheus for queue backlog: `jobs_queue_depth`
4. Trace a slow request: find `x-trace-id` in logs → open in Tempo

### Payment Failures Spike

1. Check alert: `PaymentFailureRate`
2. Verify payment provider status (Stripe/Odoo)
3. Check plugin gateway metrics if using payment plugins
4. Review recent plugin installations or config changes

### Queue Backlog Growing

1. Check `jobs_queue_depth` in Prometheus
2. Verify Redis is healthy: `redis-cli ping`
3. Check worker mode: `WORKER_MODE` should be `embedded` or `standalone`
4. If Redis is down, API degrades to inline execution with warn logs
5. Scale workers: set `WORKER_MODE=standalone` and run multiple `pnpm worker` instances
