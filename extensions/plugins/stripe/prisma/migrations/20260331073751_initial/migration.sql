-- CreateTable
CREATE TABLE "PaymentRecord" (
    "id" TEXT NOT NULL,
    "installationId" TEXT NOT NULL DEFAULT 'default',
    "orderId" TEXT NOT NULL,
    "stripePaymentIntentId" TEXT,
    "stripeSessionId" TEXT,
    "stripeSessionUrl" TEXT,
    "sessionExpiresAt" TIMESTAMP(3),
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "customerEmail" TEXT,
    "metadata" JSONB,
    "errorMessage" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefundRecord" (
    "id" TEXT NOT NULL,
    "installationId" TEXT NOT NULL DEFAULT 'default',
    "paymentRecordId" TEXT NOT NULL,
    "stripeRefundId" TEXT,
    "amount" INTEGER NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RefundRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "installationId" TEXT NOT NULL DEFAULT 'default',
    "stripeEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "payload" JSONB NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRecord_stripePaymentIntentId_key" ON "PaymentRecord"("stripePaymentIntentId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRecord_stripeSessionId_key" ON "PaymentRecord"("stripeSessionId");

-- CreateIndex
CREATE INDEX "PaymentRecord_installationId_status_createdAt_idx" ON "PaymentRecord"("installationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentRecord_stripePaymentIntentId_idx" ON "PaymentRecord"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "PaymentRecord_stripeSessionId_idx" ON "PaymentRecord"("stripeSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRecord_installationId_orderId_key" ON "PaymentRecord"("installationId", "orderId");

-- CreateIndex
CREATE UNIQUE INDEX "RefundRecord_stripeRefundId_key" ON "RefundRecord"("stripeRefundId");

-- CreateIndex
CREATE INDEX "RefundRecord_installationId_createdAt_idx" ON "RefundRecord"("installationId", "createdAt");

-- CreateIndex
CREATE INDEX "RefundRecord_stripeRefundId_idx" ON "RefundRecord"("stripeRefundId");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_stripeEventId_key" ON "WebhookEvent"("stripeEventId");

-- CreateIndex
CREATE INDEX "WebhookEvent_installationId_eventType_createdAt_idx" ON "WebhookEvent"("installationId", "eventType", "createdAt");

-- CreateIndex
CREATE INDEX "WebhookEvent_stripeEventId_idx" ON "WebhookEvent"("stripeEventId");

-- AddForeignKey
ALTER TABLE "RefundRecord" ADD CONSTRAINT "RefundRecord_paymentRecordId_fkey" FOREIGN KEY ("paymentRecordId") REFERENCES "PaymentRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
