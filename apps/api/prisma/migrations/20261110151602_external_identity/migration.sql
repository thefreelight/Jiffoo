-- AlterTable
ALTER TABLE "users" ALTER COLUMN "password" DROP NOT NULL;

-- CreateTable
CREATE TABLE "external_identities" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "providerSlug" TEXT NOT NULL,
    "issuer" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "external_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity_transactions" (
    "id" TEXT NOT NULL,
    "providerSlug" TEXT NOT NULL,
    "issuer" TEXT NOT NULL,
    "stateHash" TEXT NOT NULL,
    "bindingHash" TEXT NOT NULL,
    "encryptedPayload" TEXT,
    "intent" TEXT NOT NULL,
    "returnTo" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "userId" TEXT,
    "sessionVersion" INTEGER,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "claimedAt" TIMESTAMPTZ(3),
    "verifiedIdentity" JSONB,
    "handoffHash" TEXT,
    "handoffExpiresAt" TIMESTAMPTZ(3),
    "consumedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "identity_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "external_identities_userId_idx" ON "external_identities"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "external_identities_issuer_subject_key" ON "external_identities"("issuer", "subject");

-- CreateIndex
CREATE UNIQUE INDEX "identity_transactions_stateHash_key" ON "identity_transactions"("stateHash");

-- CreateIndex
CREATE UNIQUE INDEX "identity_transactions_handoffHash_key" ON "identity_transactions"("handoffHash");

-- CreateIndex
CREATE INDEX "identity_transactions_expiresAt_idx" ON "identity_transactions"("expiresAt");

-- CreateIndex
CREATE INDEX "identity_transactions_userId_idx" ON "identity_transactions"("userId");

-- AddForeignKey
ALTER TABLE "external_identities" ADD CONSTRAINT "external_identities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity_transactions" ADD CONSTRAINT "identity_transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

