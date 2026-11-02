-- The accepted capture of an order is the source of its paid moment, and the
-- paid-order read of G4-R scans it by capture time. The partial index carries
-- exactly the rows that the read accepts.
CREATE INDEX IF NOT EXISTS "payment_ledger_accepted_capture_created_idx"
  ON "payment_ledger" ("createdAt", "orderId", "id")
  WHERE "eventType" = 'SUCCEEDED' AND "refundRequired" = false;
