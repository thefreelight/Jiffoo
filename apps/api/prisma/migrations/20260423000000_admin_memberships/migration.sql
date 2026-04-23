-- CreateTable
CREATE TABLE "public"."admin_memberships" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "isOwner" BOOLEAN NOT NULL DEFAULT false,
    "extraPermissions" JSONB,
    "revokedPermissions" JSONB,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_memberships_userId_key" ON "public"."admin_memberships"("userId");

-- CreateIndex
CREATE INDEX "admin_memberships_role_idx" ON "public"."admin_memberships"("role");

-- CreateIndex
CREATE INDEX "admin_memberships_status_idx" ON "public"."admin_memberships"("status");

-- AddForeignKey
ALTER TABLE "public"."admin_memberships"
ADD CONSTRAINT "admin_memberships_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "public"."users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill legacy admin users into the new membership table.
INSERT INTO "public"."admin_memberships" (
    "id",
    "userId",
    "role",
    "status",
    "isOwner",
    "createdAt",
    "updatedAt"
)
SELECT
    concat('adm_', md5(random()::text || clock_timestamp()::text || u."id")),
    u."id",
    CASE
        WHEN u."role" = 'SUPER_ADMIN' THEN 'OWNER'
        WHEN u."role" = 'TENANT_ADMIN' THEN 'ADMIN'
        ELSE u."role"
    END AS "role",
    'ACTIVE' AS "status",
    CASE
        WHEN u."role" IN ('SUPER_ADMIN', 'OWNER') THEN true
        ELSE false
    END AS "isOwner",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "public"."users" u
WHERE u."role" IN (
    'ADMIN',
    'SUPER_ADMIN',
    'TENANT_ADMIN',
    'OWNER',
    'CATALOG_MANAGER',
    'OPERATIONS_MANAGER',
    'SUPPORT_AGENT',
    'ANALYST'
)
ON CONFLICT ("userId") DO NOTHING;
