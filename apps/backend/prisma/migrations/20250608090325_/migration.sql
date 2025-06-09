/*
  Warnings:

  - You are about to drop the `Payment` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Payment";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT,
    "subscriptionId" TEXT,
    "amount" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "method" TEXT NOT NULL,
    "paymentMethod" TEXT,
    "status" TEXT NOT NULL,
    "provider" TEXT,
    "providerResponse" TEXT,
    "transactionId" TEXT,
    "reference" TEXT,
    "stripePaymentIntentId" TEXT,
    "clientSecret" TEXT,
    "redirectUrl" TEXT,
    "webhookUrl" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "payments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "payments_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "paymentId" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL,
    "reason" TEXT,
    "provider" TEXT,
    "providerRefundId" TEXT,
    "providerResponse" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "refunds_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "social_accounts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "profile" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "social_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "oauth2_authorization_codes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "oauth2_access_tokens" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "userId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "tokenType" TEXT NOT NULL DEFAULT 'Bearer',
    "expiresAt" DATETIME NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "oauth2_access_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "saas_applications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "billingType" TEXT NOT NULL DEFAULT 'monthly',
    "apiEndpoint" TEXT NOT NULL,
    "webhookUrl" TEXT,
    "ssoEnabled" BOOLEAN NOT NULL DEFAULT false,
    "dataSync" BOOLEAN NOT NULL DEFAULT false,
    "logo" TEXT NOT NULL,
    "screenshots" TEXT NOT NULL,
    "features" TEXT NOT NULL,
    "requirements" TEXT NOT NULL,
    "documentation" TEXT NOT NULL,
    "support" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "totalInstalls" INTEGER NOT NULL DEFAULT 0,
    "rating" REAL NOT NULL DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "revenueShare" REAL NOT NULL DEFAULT 30,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "saas_installations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "installedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAccessedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ssoConfig" TEXT,
    "syncConfig" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "saas_installations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "saas_installations_appId_fkey" FOREIGN KEY ("appId") REFERENCES "saas_applications" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "payments_orderId_key" ON "payments"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_stripePaymentIntentId_key" ON "payments"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "payments_subscriptionId_idx" ON "payments"("subscriptionId");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- CreateIndex
CREATE INDEX "payments_provider_idx" ON "payments"("provider");

-- CreateIndex
CREATE INDEX "payments_transactionId_idx" ON "payments"("transactionId");

-- CreateIndex
CREATE INDEX "payments_stripePaymentIntentId_idx" ON "payments"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "refunds_paymentId_idx" ON "refunds"("paymentId");

-- CreateIndex
CREATE INDEX "refunds_status_idx" ON "refunds"("status");

-- CreateIndex
CREATE INDEX "refunds_provider_idx" ON "refunds"("provider");

-- CreateIndex
CREATE INDEX "refunds_providerRefundId_idx" ON "refunds"("providerRefundId");

-- CreateIndex
CREATE INDEX "social_accounts_userId_idx" ON "social_accounts"("userId");

-- CreateIndex
CREATE INDEX "social_accounts_provider_idx" ON "social_accounts"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "social_accounts_provider_providerId_key" ON "social_accounts"("provider", "providerId");

-- CreateIndex
CREATE UNIQUE INDEX "oauth2_authorization_codes_code_key" ON "oauth2_authorization_codes"("code");

-- CreateIndex
CREATE INDEX "oauth2_authorization_codes_code_idx" ON "oauth2_authorization_codes"("code");

-- CreateIndex
CREATE INDEX "oauth2_authorization_codes_clientId_idx" ON "oauth2_authorization_codes"("clientId");

-- CreateIndex
CREATE INDEX "oauth2_authorization_codes_expiresAt_idx" ON "oauth2_authorization_codes"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "oauth2_access_tokens_accessToken_key" ON "oauth2_access_tokens"("accessToken");

-- CreateIndex
CREATE UNIQUE INDEX "oauth2_access_tokens_refreshToken_key" ON "oauth2_access_tokens"("refreshToken");

-- CreateIndex
CREATE INDEX "oauth2_access_tokens_userId_idx" ON "oauth2_access_tokens"("userId");

-- CreateIndex
CREATE INDEX "oauth2_access_tokens_clientId_idx" ON "oauth2_access_tokens"("clientId");

-- CreateIndex
CREATE INDEX "oauth2_access_tokens_expiresAt_idx" ON "oauth2_access_tokens"("expiresAt");

-- CreateIndex
CREATE INDEX "oauth2_access_tokens_revoked_idx" ON "oauth2_access_tokens"("revoked");

-- CreateIndex
CREATE INDEX "saas_applications_authorId_idx" ON "saas_applications"("authorId");

-- CreateIndex
CREATE INDEX "saas_applications_category_idx" ON "saas_applications"("category");

-- CreateIndex
CREATE INDEX "saas_applications_isActive_idx" ON "saas_applications"("isActive");

-- CreateIndex
CREATE INDEX "saas_applications_isApproved_idx" ON "saas_applications"("isApproved");

-- CreateIndex
CREATE INDEX "saas_installations_userId_idx" ON "saas_installations"("userId");

-- CreateIndex
CREATE INDEX "saas_installations_appId_idx" ON "saas_installations"("appId");

-- CreateIndex
CREATE INDEX "saas_installations_status_idx" ON "saas_installations"("status");

-- CreateIndex
CREATE UNIQUE INDEX "saas_installations_userId_appId_key" ON "saas_installations"("userId", "appId");
