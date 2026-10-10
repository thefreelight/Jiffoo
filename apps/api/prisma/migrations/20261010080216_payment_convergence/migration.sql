-- AlterEnum
ALTER TYPE "PaymentAttemptStatus" ADD VALUE 'CREATING';

-- AlterTable
ALTER TABLE "event_records" ADD COLUMN     "dedupKey" TEXT;

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "dedupKey" TEXT;

-- AlterTable
ALTER TABLE "payment_ledger" ADD COLUMN     "actorType" TEXT,
ADD COLUMN     "manualReference" TEXT,
ADD COLUMN     "refundReason" TEXT,
ADD COLUMN     "refundRequired" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "claimToken" UUID,
ADD COLUMN     "claimedBy" TEXT,
ADD COLUMN     "leaseUntil" TIMESTAMPTZ(3),
ADD COLUMN     "nextReconcileAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "refunds" ADD COLUMN     "reference" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "event_records_dedupKey_key" ON "event_records"("dedupKey");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_dedupKey_key" ON "notifications"("dedupKey");

-- CreateIndex
CREATE INDEX "payments_status_nextReconcileAt_idx" ON "payments"("status", "nextReconcileAt");

-- CreateIndex
CREATE INDEX "payments_status_leaseUntil_idx" ON "payments"("status", "leaseUntil");

-- Hand-written guards: conflicting financial facts must be reviewed, never guessed or deleted.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM payments WHERE status NOT IN ('SUCCEEDED','FAILED','CANCELLED','EXPIRED') GROUP BY "orderId" HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'B11a: multiple open payments exist for one order';
  END IF;
  IF EXISTS (SELECT 1 FROM payment_ledger WHERE "eventType" = 'SUCCEEDED' GROUP BY "paymentId" HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'B11a: duplicate successful ledger rows exist for one payment';
  END IF;
  IF EXISTS (SELECT 1 FROM refunds WHERE status = 'COMPLETED' GROUP BY "paymentId" HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'B11a: multiple completed full refunds exist for one payment';
  END IF;
  IF EXISTS (SELECT 1 FROM refunds WHERE status = 'COMPLETED' AND ("reference" IS NULL OR btrim("reference") = '')) THEN
    RAISE EXCEPTION 'B11a: completed offline refunds require an explicit reference';
  END IF;
  IF EXISTS (SELECT 1 FROM event_records WHERE type = 'order.paid' GROUP BY "aggregateId" HAVING count(*) > 1)
    OR EXISTS (SELECT 1 FROM event_records WHERE type = 'payment.succeeded' GROUP BY data->>'orderId' HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'B11a: duplicate paid events exist for one order';
  END IF;
  IF EXISTS (SELECT 1 FROM event_records WHERE type = 'payment.succeeded' AND coalesce(data->>'orderId','') = '') THEN
    RAISE EXCEPTION 'B11a: a payment succeeded event has no order identity';
  END IF;
  IF EXISTS (SELECT 1 FROM notifications WHERE type IN ('payment_received','order_confirmation') AND "relatedType" = 'order' AND "resentFromId" IS NULL GROUP BY type,"relatedId" HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'B11a: duplicate automatic payment or confirmation notifications exist for one order';
  END IF;
END $$;

-- Hand-written deterministic keys for existing order-scoped facts, after conflict guards.
UPDATE event_records SET "dedupKey" = 'event:order.paid:' || "aggregateId" WHERE type = 'order.paid';
UPDATE event_records SET "dedupKey" = 'event:payment.succeeded:' || (data->>'orderId') WHERE type = 'payment.succeeded';
UPDATE notifications SET "dedupKey" = 'notification:payment_received:' || "relatedId"
WHERE type = 'payment_received' AND "relatedType" = 'order' AND "resentFromId" IS NULL;
UPDATE notifications SET "dedupKey" = 'notification:order_confirmation:' || "relatedId"
WHERE type = 'order_confirmation' AND "relatedType" = 'order' AND "resentFromId" IS NULL;

-- Only CREATING and PENDING are nonterminal in v1. Existing enum literals keep this safe in an enum-adding migration.
CREATE UNIQUE INDEX "payments_one_open_per_order"
ON payments("orderId") WHERE status NOT IN ('SUCCEEDED','FAILED','CANCELLED','EXPIRED');
CREATE UNIQUE INDEX "payment_ledger_one_success_per_payment"
ON payment_ledger("paymentId") WHERE "eventType" = 'SUCCEEDED';
CREATE UNIQUE INDEX "refunds_one_completed_per_payment"
ON refunds("paymentId") WHERE status = 'COMPLETED';
CREATE UNIQUE INDEX "event_records_one_order_paid"
ON event_records("aggregateId") WHERE type = 'order.paid';
CREATE UNIQUE INDEX "event_records_one_payment_succeeded_per_order"
ON event_records((data->>'orderId')) WHERE type = 'payment.succeeded';
CREATE UNIQUE INDEX "notifications_one_automatic_payment_received"
ON notifications("relatedId") WHERE type = 'payment_received' AND "relatedType" = 'order' AND "resentFromId" IS NULL;

-- Hand-written lease, reservation and offline-reference invariants.
ALTER TABLE payments ADD CONSTRAINT "payments_reconciliation_lease_check"
CHECK (("claimToken" IS NULL AND "claimedBy" IS NULL AND "leaseUntil" IS NULL)
  OR ("claimToken" IS NOT NULL AND "claimedBy" IS NOT NULL AND "leaseUntil" IS NOT NULL
      AND status NOT IN ('SUCCEEDED','FAILED','CANCELLED','EXPIRED')));
ALTER TABLE payments ADD CONSTRAINT "payments_creating_reservation_check"
CHECK (status::text <> 'CREATING'
  OR ("sessionId" IS NULL AND "expiresAt" IS NOT NULL AND "idempotencyKey" IS NOT NULL AND btrim("idempotencyKey") <> ''));
ALTER TABLE refunds ADD CONSTRAINT "refunds_offline_reference_check"
CHECK (status <> 'COMPLETED' OR ("reference" IS NOT NULL AND btrim("reference") <> ''));
ALTER TABLE payment_ledger ADD CONSTRAINT "payment_ledger_manual_reference_check"
CHECK ("eventType" <> 'SUCCEEDED' OR "actorType" IS DISTINCT FROM 'admin'
  OR ("manualReference" IS NOT NULL AND btrim("manualReference") <> ''));

