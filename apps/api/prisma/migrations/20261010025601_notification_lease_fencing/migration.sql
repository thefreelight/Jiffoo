-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "claimToken" UUID,
ADD COLUMN     "claimedBy" TEXT,
ADD COLUMN     "leaseUntil" TIMESTAMPTZ(3);

-- Backfill interrupted sends as immediately expired claims; reclaim accounts for the attempt.
UPDATE "notifications"
SET "leaseUntil" = clock_timestamp(), "claimToken" = gen_random_uuid()
WHERE "status" = 'SENDING';

-- A sending notification owns a complete lease; every other state owns no lease.
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_sending_lease_check"
CHECK (("status" = 'SENDING' AND "claimToken" IS NOT NULL AND "leaseUntil" IS NOT NULL)
    OR ("status" <> 'SENDING' AND "claimToken" IS NULL AND "leaseUntil" IS NULL));

-- Bound expired-lease scans without serializing unrelated notification claims.
CREATE INDEX "notifications_status_leaseUntil_idx"
ON "notifications"("status", "leaseUntil");
