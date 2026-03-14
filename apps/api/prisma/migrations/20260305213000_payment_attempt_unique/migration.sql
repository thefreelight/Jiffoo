-- Enforce one payment record per order attempt.
DROP INDEX IF EXISTS "public"."payments_orderId_attemptNumber_idx";
CREATE UNIQUE INDEX IF NOT EXISTS "payments_orderId_attemptNumber_key"
ON "public"."payments"("orderId", "attemptNumber");
