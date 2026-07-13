# Async Task Layer Inventory

> Generated: 2026-07-05
> Task: 4.1.1–4.1.2 (Async infrastructure inventory and OutboxEvent field audit)

## 1. Existing Async Infrastructure

### 1.1 OutboxEvent Model

**Location**: `apps/api/prisma/schema/system.prisma`

**Fields**:
| Field | Type | Description |
|-------|------|-------------|
| id | String @id | UUID, also used as BullMQ job ID for idempotency |
| aggregateType | String | Entity type (e.g., `order`, `payment`) |
| aggregateId | String | Entity ID |
| eventType | String | Event name (e.g., `order.created`) |
| payload | Json | Event payload |
| metadata | Json? | Additional metadata (includes processing status) |
| createdAt | DateTime | Event creation timestamp |

**Status/Retry Fields**: The model does **not** have dedicated `status` or `retryCount` fields. Processing state is tracked via:
- BullMQ job state (waiting/active/completed/failed)
- `metadata.processedAt` — set by the worker after successful processing
- `metadata.deadLettered` — set when job exceeds max retries

No new migration was needed — the metadata JSON field provides sufficient flexibility.

### 1.2 Existing Webhook Delivery

**Location**: `apps/api/src/core/webhooks/`

**Current Implementation**: Synchronous delivery within the request lifecycle. The `WebhookDeliveryService` fetches active subscriptions and delivers via HTTP.

**Migration Target**: `webhook-delivery` queue in BullMQ. Delivery results written to `WebhookDeliveryLog`. After 5 failures, routed to `WebhookDeadLetter` (existing tables).

### 1.3 Email Sending

**Location**: `apps/api/src/plugins/email-providers/`

**Current Implementation**: Direct provider calls (SMTP/SendGrid/etc.) via `EmailService.send()`.

**Migration Target**: `email` queue in BullMQ. Order confirmation, shipping notification, and verification emails will be enqueued. The email-providers abstraction is preserved.

### 1.4 Stock Alert Scanning

**Location**: `apps/api/src/core/stock-alert/`

**Current Implementation**: Periodic scan triggered by a cron-like setInterval within the API process.

**Migration Target**: BullMQ repeatable job (cron schedule). Replaces the setInterval-based trigger.

### 1.5 Order Fulfillment (Virtual Goods)

**Location**: `apps/api/src/core/order/` + product-type-specific fulfillment modules

**Current Implementation**: Post-payment hook triggers fulfillment logic synchronously.

**Migration Target**: `fulfillment` queue in BullMQ. Only the trigger mechanism changes — business logic remains untouched.

## 2. OutboxEvent Write Sites

The following code paths write to `OutboxEvent`:

| Module | File | Event Types |
|--------|------|-------------|
| Order | `src/core/order/service.ts` | `order.created`, `order.cancelled` |
| Payment | `src/core/payment/service.ts` | `payment.success`, `payment.failed` |
| Webhook | `src/core/webhooks/service.ts` | `webhook.delivery.*` |

## 3. Worker Modes

| Mode | Env | Description |
|------|-----|-------------|
| `embedded` | `WORKER_MODE=embedded` | Worker runs inside the API process (default for single-host) |
| `standalone` | `WORKER_MODE=standalone` | Worker runs as a separate process (`pnpm worker`) |
| `off` | `WORKER_MODE=off` | No worker — all processing is synchronous (testing only) |

## 4. Queue Definitions

| Queue Name | Handler | Retry | DLQ |
|------------|---------|-------|-----|
| `webhook-delivery` | `webhookDeliveryHandler` | 5x exponential backoff | `WebhookDeadLetter` table |
| `email` | `emailHandler` | 5x exponential backoff | `dead-letter` queue + structured log |
| `stock-alert` | `stockAlertHandler` | 3x (repeatable cron) | Structured log |
| `fulfillment` | `fulfillmentHandler` | 5x exponential backoff | `dead-letter` queue + structured log |
