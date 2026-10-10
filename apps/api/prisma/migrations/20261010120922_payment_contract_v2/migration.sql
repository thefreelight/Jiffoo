-- Hand-written preflight: v1 rows have no provable v2 account or capture identity.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM payments) OR EXISTS (SELECT 1 FROM payment_ledger) OR EXISTS (SELECT 1 FROM refunds) THEN
    RAISE EXCEPTION 'B11b: existing payment, ledger or refund data requires reviewed v2 identities';
  END IF;
END $$;

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PaymentAttemptStatus" ADD VALUE 'UNKNOWN';
ALTER TYPE "PaymentAttemptStatus" ADD VALUE 'REQUIRES_REVIEW';

-- DropIndex
DROP INDEX "payment_ledger_providerEventId_key";

-- DropIndex
DROP INDEX "payments_paymentIntentId_key";

-- DropIndex
DROP INDEX "payments_providerEventId_key";

-- DropIndex
DROP INDEX "payments_sessionId_key";

-- AlterTable
ALTER TABLE "payment_ledger" ADD COLUMN     "providerKey" UUID,
ADD COLUMN     "providerPaymentId" TEXT;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "closedAt" TIMESTAMPTZ(3),
ADD COLUMN     "closureObservationId" UUID,
ADD COLUMN     "providerKey" UUID NOT NULL;

-- AlterTable
ALTER TABLE "refunds" ADD COLUMN     "paymentLedgerId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "payment_provider_accounts" (
    "providerKey" UUID NOT NULL,
    "namespace" TEXT NOT NULL,
    "merchantAccount" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_provider_accounts_pkey" PRIMARY KEY ("providerKey")
);

-- CreateTable
CREATE TABLE "payment_provider_bindings" (
    "installationId" TEXT NOT NULL,
    "providerKey" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_provider_bindings_pkey" PRIMARY KEY ("installationId","providerKey")
);

-- CreateTable
CREATE TABLE "payment_observations" (
    "id" UUID NOT NULL,
    "paymentId" TEXT,
    "providerKey" UUID,
    "source" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "sessionId" TEXT,
    "providerEventId" TEXT,
    "evidenceHash" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,
    "verification" TEXT NOT NULL,
    "mismatchReason" TEXT,
    "receivedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_observations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_provider_accounts_namespace_merchantAccount_environ_key" ON "payment_provider_accounts"("namespace", "merchantAccount", "environment");

-- CreateIndex
CREATE INDEX "payment_observations_providerKey_providerEventId_idx" ON "payment_observations"("providerKey", "providerEventId");

-- CreateIndex
CREATE INDEX "payment_observations_paymentId_receivedAt_idx" ON "payment_observations"("paymentId", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "payment_observations_source_evidenceHash_key" ON "payment_observations"("source", "evidenceHash");

-- CreateIndex
CREATE UNIQUE INDEX "payment_ledger_providerKey_providerPaymentId_key" ON "payment_ledger"("providerKey", "providerPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_closureObservationId_key" ON "payments"("closureObservationId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_providerKey_sessionId_key" ON "payments"("providerKey", "sessionId");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_providerKey_fkey" FOREIGN KEY ("providerKey") REFERENCES "payment_provider_accounts"("providerKey") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_closureObservationId_fkey" FOREIGN KEY ("closureObservationId") REFERENCES "payment_observations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_paymentLedgerId_fkey" FOREIGN KEY ("paymentLedgerId") REFERENCES "payment_ledger"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_provider_bindings" ADD CONSTRAINT "payment_provider_bindings_providerKey_fkey" FOREIGN KEY ("providerKey") REFERENCES "payment_provider_accounts"("providerKey") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_observations" ADD CONSTRAINT "payment_observations_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Hand-written capture and closure invariants; no financial identity is guessed.
ALTER TABLE "payment_ledger" ADD CONSTRAINT "payment_ledger_providerKey_fkey" FOREIGN KEY ("providerKey") REFERENCES "payment_provider_accounts"("providerKey") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_observations" ADD CONSTRAINT "payment_observations_providerKey_fkey" FOREIGN KEY ("providerKey") REFERENCES "payment_provider_accounts"("providerKey") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE payments DROP CONSTRAINT "payments_reconciliation_lease_check";
ALTER TABLE payments ADD CONSTRAINT "payments_reconciliation_lease_check"
CHECK (("claimToken" IS NULL AND "claimedBy" IS NULL AND "leaseUntil" IS NULL)
  OR ("claimToken" IS NOT NULL AND "claimedBy" IS NOT NULL AND "leaseUntil" IS NOT NULL
      AND status::text IN ('CREATING','PENDING','UNKNOWN','SUCCEEDED','CANCELLED')));
DROP INDEX "payment_ledger_one_success_per_payment";
DROP INDEX "refunds_one_completed_per_payment";
CREATE UNIQUE INDEX "payment_ledger_one_accepted_capture_per_order"
ON payment_ledger("orderId") WHERE "eventType" = 'SUCCEEDED' AND "refundRequired" = false;
CREATE UNIQUE INDEX "refunds_one_completed_per_capture"
ON refunds("paymentLedgerId") WHERE status = 'COMPLETED';
ALTER TABLE payment_provider_accounts ADD CONSTRAINT "payment_provider_account_identity_check"
CHECK (btrim(namespace) <> '' AND btrim("merchantAccount") <> '' AND environment IN ('live','test'));
ALTER TABLE payments ADD CONSTRAINT "payments_v2_request_key_check"
CHECK ("idempotencyKey" IS NOT NULL AND btrim("idempotencyKey") <> '');
ALTER TABLE payments ADD CONSTRAINT "payments_closure_reference_check"
CHECK (("closureObservationId" IS NULL) = ("closedAt" IS NULL));
ALTER TABLE payment_ledger ADD CONSTRAINT "payment_ledger_capture_identity_check"
CHECK ("eventType" <> 'SUCCEEDED' OR ("providerKey" IS NOT NULL AND "providerPaymentId" IS NOT NULL AND btrim("providerPaymentId") <> ''));
ALTER TABLE payment_observations ADD CONSTRAINT "payment_observations_evidence_check"
CHECK (source IN ('creation','query','webhook') AND verification = 'verified'
  AND btrim("requestKey") <> '' AND "evidenceHash" ~ '^[0-9a-f]{64}$');
CREATE FUNCTION payment_provider_account_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW."providerKey",NEW.namespace,NEW."merchantAccount",NEW.environment)
     IS DISTINCT FROM ROW(OLD."providerKey",OLD.namespace,OLD."merchantAccount",OLD.environment) THEN
    RAISE EXCEPTION 'Payment provider account identity is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER payment_provider_account_immutable
BEFORE UPDATE ON payment_provider_accounts FOR EACH ROW EXECUTE FUNCTION payment_provider_account_immutable();
CREATE FUNCTION payment_v2_proof_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."providerKey" IS DISTINCT FROM OLD."providerKey" OR NEW."idempotencyKey" IS DISTINCT FROM OLD."idempotencyKey" THEN
    RAISE EXCEPTION 'Payment account and request identity are immutable' USING ERRCODE = '23514';
  END IF;
  IF NEW."closureObservationId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM payment_observations o WHERE o.id = NEW."closureObservationId"
      AND o."paymentId" = NEW.id AND o."providerKey" = NEW."providerKey"
      AND o."requestKey" = NEW."idempotencyKey" AND o.source = 'query'
      AND o.verification = 'verified' AND o."mismatchReason" IS NULL
      AND o.evidence->>'canStillBeCharged' = 'false' AND o.evidence->>'requestClosed' = 'true'
  ) THEN
    RAISE EXCEPTION 'Payment closure requires verified request-key proof' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER payment_v2_proof_guard BEFORE UPDATE ON payments
FOR EACH ROW EXECUTE FUNCTION payment_v2_proof_guard();
CREATE FUNCTION payment_capture_refund_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM payment_ledger l WHERE l.id = NEW."paymentLedgerId"
      AND l."eventType" = 'SUCCEEDED' AND l."paymentId" = NEW."paymentId"
      AND l."orderId" = NEW."orderId" AND l.amount = NEW.amount AND l.currency = NEW.currency
  ) THEN
    RAISE EXCEPTION 'Offline full refund must match its captured payment fact' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER payment_capture_refund_guard BEFORE INSERT OR UPDATE ON refunds
FOR EACH ROW EXECUTE FUNCTION payment_capture_refund_guard();
CREATE FUNCTION payment_capture_identity_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."eventType" = 'SUCCEEDED' AND NOT EXISTS (
    SELECT 1 FROM payments p WHERE p.id = NEW."paymentId" AND p."orderId" = NEW."orderId"
      AND p."providerKey" = NEW."providerKey" AND p.amount = NEW.amount AND p.currency = NEW.currency
  ) THEN
    RAISE EXCEPTION 'Capture identity and full amount must match its payment' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER payment_capture_identity_guard BEFORE INSERT OR UPDATE ON payment_ledger
FOR EACH ROW EXECUTE FUNCTION payment_capture_identity_guard();

-- Capture identity belongs only to captured-payment facts.
ALTER TABLE payment_ledger ADD CONSTRAINT "payment_ledger_capture_identity_scope_check"
CHECK ("eventType" = 'SUCCEEDED' OR ("providerKey" IS NULL AND "providerPaymentId" IS NULL));
