-- AlterTable
ALTER TABLE "users" ADD COLUMN     "removedAt" TIMESTAMP(3);

-- Backfill historical administrator removals and revoke invitations atomically.
-- Repeating this backfill does not increment an already-correct removal state.
WITH latest_removals AS (
    SELECT "staffUserId", MAX("createdAt") AS "removedAt"
    FROM public.admin_staff_audit_logs
    WHERE "action" = 'ADMIN_REMOVED'
    GROUP BY "staffUserId"
),
removed_admins AS (
    UPDATE public.users AS u
    SET "removedAt" = r."removedAt",
        "isActive" = false,
        "sessionVersion" = u."sessionVersion" + CASE
            WHEN u."removedAt" IS DISTINCT FROM r."removedAt" OR u."isActive"
                THEN 1
            ELSE 0
        END
    FROM latest_removals AS r
    WHERE u."id" = r."staffUserId"
      AND u."role" = 'ADMIN'
    RETURNING u."id"
)
UPDATE public.auth_tokens AS t
SET "consumedAt" = CURRENT_TIMESTAMP AT TIME ZONE 'UTC'
FROM removed_admins AS u
WHERE t."userId" = u."id"
  AND t."purpose" = 'STAFF_INVITE'
  AND t."consumedAt" IS NULL;
