-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "reviewReference" TEXT,
ADD COLUMN     "reviewResolution" TEXT,
ADD COLUMN     "reviewResolvedAt" TIMESTAMPTZ(3),
ADD COLUMN     "reviewResolvedBy" TEXT;

-- Hand-written invariant: admin conclusions are complete and separate from provider closure proof.
ALTER TABLE payments ADD CONSTRAINT "payments_review_resolution_check"
CHECK (
  ("reviewResolution" IS NULL AND "reviewResolvedAt" IS NULL
    AND "reviewResolvedBy" IS NULL AND "reviewReference" IS NULL)
  OR
  ("reviewResolution" IS NOT NULL AND "reviewResolution" = 'NOT_CHARGED'
    AND "reviewResolvedAt" IS NOT NULL AND "reviewResolvedBy" IS NOT NULL
    AND "reviewReference" IS NOT NULL AND "reviewReference" ~ '[^[:space:]]'
    AND status::text IN ('FAILED','SUCCEEDED')
    AND "closureObservationId" IS NULL AND "closedAt" IS NULL)
);

-- Hand-written guard: only unresolved review rows may receive an immutable admin conclusion.
CREATE FUNCTION payment_review_resolution_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."reviewResolution" IS NOT NULL OR NEW."reviewResolvedAt" IS NOT NULL
      OR NEW."reviewResolvedBy" IS NOT NULL OR NEW."reviewReference" IS NOT NULL THEN
      RAISE EXCEPTION 'Admin resolution requires an existing unresolved payment review' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;
  IF ROW(NEW."reviewResolution",NEW."reviewResolvedAt",NEW."reviewResolvedBy",NEW."reviewReference")
    IS DISTINCT FROM ROW(OLD."reviewResolution",OLD."reviewResolvedAt",OLD."reviewResolvedBy",OLD."reviewReference") THEN
    IF OLD."reviewResolution" IS NOT NULL OR OLD.status::text <> 'REQUIRES_REVIEW'
      OR NEW."reviewResolution" IS DISTINCT FROM 'NOT_CHARGED' OR NEW.status::text <> 'FAILED' THEN
      RAISE EXCEPTION 'Admin resolution may only close an unresolved payment review' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF OLD."reviewResolution" IS NOT NULL AND NEW.status IS DISTINCT FROM OLD.status
    AND NOT (OLD.status::text = 'FAILED' AND NEW.status::text = 'SUCCEEDED') THEN
    RAISE EXCEPTION 'Resolved payment status may only advance from failed to succeeded' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

-- Hand-written trigger: enforce the guard on direct SQL as well as application writes.
CREATE TRIGGER payment_review_resolution_guard BEFORE INSERT OR UPDATE ON payments
FOR EACH ROW EXECUTE FUNCTION payment_review_resolution_guard();
