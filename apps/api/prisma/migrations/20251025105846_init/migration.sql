-- CreateTable
CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "avatar" TEXT,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "tenantId" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "category" TEXT,
    "images" TEXT,
    "tenantId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."orders" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID',
    "expiresAt" TIMESTAMP(3),
    "lastPaymentAttemptAt" TIMESTAMP(3),
    "paymentAttempts" INTEGER NOT NULL DEFAULT 0,
    "lastPaymentMethod" TEXT,
    "cancelReason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "customerEmail" TEXT,
    "shippingAddress" TEXT,
    "tenantId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."order_items" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "tenantId" INTEGER NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."inventory_reservations" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."carts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."cart_items" (
    "id" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "variantId" TEXT,
    "tenantId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tenants" (
    "id" SERIAL NOT NULL,
    "companyName" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT,
    "domain" TEXT,
    "subdomain" TEXT,
    "logo" TEXT,
    "theme" TEXT,
    "branding" TEXT,
    "settings" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "subscriptionTier" TEXT NOT NULL DEFAULT 'BASIC',
    "maxUsers" INTEGER NOT NULL DEFAULT 10,
    "maxProducts" INTEGER NOT NULL DEFAULT 100,
    "billingEmail" TEXT,
    "taxId" TEXT,
    "billingAddress" TEXT,
    "defaultEmailProvider" TEXT,
    "emailSettings" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."price_controls" (
    "id" TEXT NOT NULL,
    "productType" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "basePrice" DOUBLE PRECISION NOT NULL,
    "suggestedPrice" DOUBLE PRECISION,
    "minPrice" DOUBLE PRECISION,
    "maxPrice" DOUBLE PRECISION,
    "marginPercent" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" INTEGER NOT NULL,

    CONSTRAINT "price_controls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tenant_pricing" (
    "id" TEXT NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "priceControlId" TEXT NOT NULL,
    "sellingPrice" DOUBLE PRECISION NOT NULL,
    "marginAmount" DOUBLE PRECISION NOT NULL,
    "marginPercent" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_pricing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tenant_data_sync" (
    "id" TEXT NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "syncType" TEXT NOT NULL,
    "syncEndpoint" TEXT NOT NULL,
    "syncFrequency" TEXT NOT NULL DEFAULT 'daily',
    "authMethod" TEXT NOT NULL DEFAULT 'api_key',
    "authCredentials" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncStatus" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_data_sync_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "tenantId" INTEGER NOT NULL DEFAULT 0,
    "action" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "resourceId" TEXT,
    "oldValues" TEXT,
    "newValues" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."social_accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."oauth2_authorization_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth2_authorization_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."oauth2_access_tokens" (
    "id" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "userId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "scope" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "refreshExpiresAt" TIMESTAMP(3),
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "oauth2_access_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."plugins" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "longDescription" TEXT,
    "category" TEXT,
    "tags" TEXT,
    "iconUrl" TEXT,
    "screenshots" TEXT,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "developer" TEXT DEFAULT 'Jiffoo',
    "rating" DOUBLE PRECISION DEFAULT 0,
    "installCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plugins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."plugin_installations" (
    "id" TEXT NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "pluginId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trialStartDate" TIMESTAMP(3),
    "trialEndDate" TIMESTAMP(3),
    "configData" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plugin_installations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."plugin_usage" (
    "id" TEXT NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "pluginSlug" TEXT NOT NULL,
    "metricName" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "period" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plugin_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."payments" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "pluginId" TEXT,
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "paymentMethod" TEXT NOT NULL,
    "paymentIntentId" TEXT,
    "sessionId" TEXT,
    "sessionUrl" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tenant_custom_pricing" (
    "id" TEXT NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "pluginId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "pricing" TEXT NOT NULL,
    "features" TEXT NOT NULL,
    "limits" TEXT NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validTo" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_custom_pricing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tenant_feature_overrides" (
    "id" TEXT NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "pluginSlug" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "reason" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_feature_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tenant_usage_overrides" (
    "id" TEXT NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "pluginSlug" TEXT NOT NULL,
    "metricName" TEXT NOT NULL,
    "limitValue" INTEGER NOT NULL,
    "reason" TEXT,
    "createdBy" TEXT NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_usage_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."subscriptions" (
    "id" TEXT NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "pluginId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "stripeSubscriptionId" TEXT,
    "stripeItemId" TEXT,
    "stripeCustomerId" TEXT,
    "status" TEXT NOT NULL,
    "billingCycle" TEXT NOT NULL,
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "trialStart" TIMESTAMP(3),
    "trialEnd" TIMESTAMP(3),
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "taxRate" DOUBLE PRECISION DEFAULT 0,
    "discountPercent" DOUBLE PRECISION DEFAULT 0,
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "canceledAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "resumeAt" TIMESTAMP(3),
    "autoRenew" BOOLEAN NOT NULL DEFAULT true,
    "renewalNotificationSent" BOOLEAN NOT NULL DEFAULT false,
    "metadata" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."subscription_changes" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "changeType" TEXT NOT NULL,
    "fromPlanId" TEXT,
    "toPlanId" TEXT,
    "fromAmount" DOUBLE PRECISION,
    "toAmount" DOUBLE PRECISION,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "prorationAmount" DOUBLE PRECISION,
    "reason" TEXT,
    "initiatedBy" TEXT NOT NULL,
    "createdBy" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."subscription_invoices" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "stripeInvoiceId" TEXT,
    "invoiceNumber" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "paymentMethod" TEXT,
    "paymentReference" TEXT,
    "lineItems" TEXT NOT NULL,
    "metadata" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."subscription_events" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventSource" TEXT NOT NULL,
    "eventData" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3),
    "processingStatus" TEXT NOT NULL DEFAULT 'pending',
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."subscription_plans" (
    "id" TEXT NOT NULL,
    "pluginId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "billingCycle" TEXT NOT NULL,
    "trialDays" INTEGER DEFAULT 0,
    "stripePriceId" TEXT,
    "features" TEXT NOT NULL,
    "limits" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."email_logs" (
    "id" TEXT NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "pluginId" TEXT,
    "provider" TEXT NOT NULL,
    "messageId" TEXT,
    "externalId" TEXT,
    "to" TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "fromName" TEXT,
    "replyTo" TEXT,
    "cc" TEXT,
    "bcc" TEXT,
    "subject" TEXT NOT NULL,
    "html" TEXT,
    "text" TEXT,
    "attachments" TEXT,
    "status" TEXT NOT NULL,
    "queuedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "clickedAt" TIMESTAMP(3),
    "bouncedAt" TIMESTAMP(3),
    "openCount" INTEGER NOT NULL DEFAULT 0,
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "metadata" TEXT,
    "tags" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "lastRetryAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."email_templates" (
    "id" TEXT NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "text" TEXT,
    "variables" TEXT,
    "fromName" TEXT,
    "fromEmail" TEXT,
    "replyTo" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."email_queue" (
    "id" TEXT NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "provider" TEXT NOT NULL,
    "emailData" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "priority" INTEGER NOT NULL DEFAULT 5,
    "scheduledAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "nextRetryAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_queue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "users_email_idx" ON "public"."users"("email");

-- CreateIndex
CREATE INDEX "users_tenantId_idx" ON "public"."users"("tenantId");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "public"."users"("role");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_tenantId_key" ON "public"."users"("email", "tenantId");

-- CreateIndex
CREATE INDEX "products_tenantId_idx" ON "public"."products"("tenantId");

-- CreateIndex
CREATE INDEX "products_category_idx" ON "public"."products"("category");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "public"."orders"("status");

-- CreateIndex
CREATE INDEX "orders_paymentStatus_idx" ON "public"."orders"("paymentStatus");

-- CreateIndex
CREATE INDEX "orders_expiresAt_idx" ON "public"."orders"("expiresAt");

-- CreateIndex
CREATE INDEX "orders_tenantId_idx" ON "public"."orders"("tenantId");

-- CreateIndex
CREATE INDEX "orders_userId_tenantId_idx" ON "public"."orders"("userId", "tenantId");

-- CreateIndex
CREATE INDEX "order_items_tenantId_idx" ON "public"."order_items"("tenantId");

-- CreateIndex
CREATE INDEX "order_items_orderId_tenantId_idx" ON "public"."order_items"("orderId", "tenantId");

-- CreateIndex
CREATE INDEX "inventory_reservations_expiresAt_status_idx" ON "public"."inventory_reservations"("expiresAt", "status");

-- CreateIndex
CREATE INDEX "inventory_reservations_productId_status_idx" ON "public"."inventory_reservations"("productId", "status");

-- CreateIndex
CREATE INDEX "inventory_reservations_tenantId_idx" ON "public"."inventory_reservations"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_reservations_orderId_productId_key" ON "public"."inventory_reservations"("orderId", "productId");

-- CreateIndex
CREATE INDEX "carts_userId_idx" ON "public"."carts"("userId");

-- CreateIndex
CREATE INDEX "carts_tenantId_idx" ON "public"."carts"("tenantId");

-- CreateIndex
CREATE INDEX "carts_status_idx" ON "public"."carts"("status");

-- CreateIndex
CREATE UNIQUE INDEX "carts_userId_tenantId_key" ON "public"."carts"("userId", "tenantId");

-- CreateIndex
CREATE INDEX "cart_items_cartId_idx" ON "public"."cart_items"("cartId");

-- CreateIndex
CREATE INDEX "cart_items_productId_idx" ON "public"."cart_items"("productId");

-- CreateIndex
CREATE INDEX "cart_items_tenantId_idx" ON "public"."cart_items"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "cart_items_cartId_productId_variantId_key" ON "public"."cart_items"("cartId", "productId", "variantId");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_contactEmail_key" ON "public"."tenants"("contactEmail");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_domain_key" ON "public"."tenants"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_subdomain_key" ON "public"."tenants"("subdomain");

-- CreateIndex
CREATE INDEX "price_controls_productType_idx" ON "public"."price_controls"("productType");

-- CreateIndex
CREATE INDEX "price_controls_tenantId_idx" ON "public"."price_controls"("tenantId");

-- CreateIndex
CREATE INDEX "price_controls_isActive_idx" ON "public"."price_controls"("isActive");

-- CreateIndex
CREATE INDEX "tenant_pricing_tenantId_idx" ON "public"."tenant_pricing"("tenantId");

-- CreateIndex
CREATE INDEX "tenant_pricing_priceControlId_idx" ON "public"."tenant_pricing"("priceControlId");

-- CreateIndex
CREATE INDEX "tenant_data_sync_tenantId_idx" ON "public"."tenant_data_sync"("tenantId");

-- CreateIndex
CREATE INDEX "tenant_data_sync_syncType_idx" ON "public"."tenant_data_sync"("syncType");

-- CreateIndex
CREATE INDEX "tenant_data_sync_isActive_idx" ON "public"."tenant_data_sync"("isActive");

-- CreateIndex
CREATE INDEX "tenant_data_sync_lastSyncAt_idx" ON "public"."tenant_data_sync"("lastSyncAt");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "public"."audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_tenantId_idx" ON "public"."audit_logs"("tenantId");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "public"."audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_module_idx" ON "public"."audit_logs"("module");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "public"."audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "social_accounts_userId_idx" ON "public"."social_accounts"("userId");

-- CreateIndex
CREATE INDEX "social_accounts_provider_idx" ON "public"."social_accounts"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "social_accounts_provider_providerId_key" ON "public"."social_accounts"("provider", "providerId");

-- CreateIndex
CREATE UNIQUE INDEX "oauth2_authorization_codes_code_key" ON "public"."oauth2_authorization_codes"("code");

-- CreateIndex
CREATE INDEX "oauth2_authorization_codes_code_idx" ON "public"."oauth2_authorization_codes"("code");

-- CreateIndex
CREATE INDEX "oauth2_authorization_codes_expiresAt_idx" ON "public"."oauth2_authorization_codes"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "oauth2_access_tokens_accessToken_key" ON "public"."oauth2_access_tokens"("accessToken");

-- CreateIndex
CREATE UNIQUE INDEX "oauth2_access_tokens_refreshToken_key" ON "public"."oauth2_access_tokens"("refreshToken");

-- CreateIndex
CREATE INDEX "oauth2_access_tokens_accessToken_idx" ON "public"."oauth2_access_tokens"("accessToken");

-- CreateIndex
CREATE INDEX "oauth2_access_tokens_refreshToken_idx" ON "public"."oauth2_access_tokens"("refreshToken");

-- CreateIndex
CREATE INDEX "oauth2_access_tokens_userId_idx" ON "public"."oauth2_access_tokens"("userId");

-- CreateIndex
CREATE INDEX "oauth2_access_tokens_expiresAt_idx" ON "public"."oauth2_access_tokens"("expiresAt");

-- CreateIndex
CREATE INDEX "oauth2_access_tokens_revoked_idx" ON "public"."oauth2_access_tokens"("revoked");

-- CreateIndex
CREATE UNIQUE INDEX "plugins_slug_key" ON "public"."plugins"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "plugin_installations_tenantId_pluginId_key" ON "public"."plugin_installations"("tenantId", "pluginId");

-- CreateIndex
CREATE UNIQUE INDEX "plugin_usage_tenantId_pluginSlug_metricName_period_key" ON "public"."plugin_usage"("tenantId", "pluginSlug", "metricName", "period");

-- CreateIndex
CREATE INDEX "payments_tenantId_idx" ON "public"."payments"("tenantId");

-- CreateIndex
CREATE INDEX "payments_pluginId_idx" ON "public"."payments"("pluginId");

-- CreateIndex
CREATE INDEX "payments_paymentIntentId_idx" ON "public"."payments"("paymentIntentId");

-- CreateIndex
CREATE INDEX "payments_sessionId_idx" ON "public"."payments"("sessionId");

-- CreateIndex
CREATE INDEX "payments_orderId_attemptNumber_idx" ON "public"."payments"("orderId", "attemptNumber");

-- CreateIndex
CREATE INDEX "tenant_custom_pricing_tenantId_idx" ON "public"."tenant_custom_pricing"("tenantId");

-- CreateIndex
CREATE INDEX "tenant_custom_pricing_pluginId_idx" ON "public"."tenant_custom_pricing"("pluginId");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_custom_pricing_tenantId_pluginId_key" ON "public"."tenant_custom_pricing"("tenantId", "pluginId");

-- CreateIndex
CREATE INDEX "tenant_feature_overrides_tenantId_idx" ON "public"."tenant_feature_overrides"("tenantId");

-- CreateIndex
CREATE INDEX "tenant_feature_overrides_pluginSlug_idx" ON "public"."tenant_feature_overrides"("pluginSlug");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_feature_overrides_tenantId_pluginSlug_feature_key" ON "public"."tenant_feature_overrides"("tenantId", "pluginSlug", "feature");

-- CreateIndex
CREATE INDEX "tenant_usage_overrides_tenantId_idx" ON "public"."tenant_usage_overrides"("tenantId");

-- CreateIndex
CREATE INDEX "tenant_usage_overrides_pluginSlug_idx" ON "public"."tenant_usage_overrides"("pluginSlug");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_usage_overrides_tenantId_pluginSlug_metricName_key" ON "public"."tenant_usage_overrides"("tenantId", "pluginSlug", "metricName");

-- CreateIndex
CREATE INDEX "subscriptions_status_idx" ON "public"."subscriptions"("status");

-- CreateIndex
CREATE INDEX "subscriptions_currentPeriodEnd_idx" ON "public"."subscriptions"("currentPeriodEnd");

-- CreateIndex
CREATE INDEX "subscriptions_stripeSubscriptionId_idx" ON "public"."subscriptions"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "subscriptions_tenantId_pluginId_status_idx" ON "public"."subscriptions"("tenantId", "pluginId", "status");

-- CreateIndex
CREATE INDEX "subscription_changes_subscriptionId_idx" ON "public"."subscription_changes"("subscriptionId");

-- CreateIndex
CREATE INDEX "subscription_changes_changeType_idx" ON "public"."subscription_changes"("changeType");

-- CreateIndex
CREATE INDEX "subscription_changes_effectiveDate_idx" ON "public"."subscription_changes"("effectiveDate");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_invoices_stripeInvoiceId_key" ON "public"."subscription_invoices"("stripeInvoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_invoices_invoiceNumber_key" ON "public"."subscription_invoices"("invoiceNumber");

-- CreateIndex
CREATE INDEX "subscription_invoices_subscriptionId_idx" ON "public"."subscription_invoices"("subscriptionId");

-- CreateIndex
CREATE INDEX "subscription_invoices_status_idx" ON "public"."subscription_invoices"("status");

-- CreateIndex
CREATE INDEX "subscription_invoices_dueDate_idx" ON "public"."subscription_invoices"("dueDate");

-- CreateIndex
CREATE INDEX "subscription_invoices_issueDate_idx" ON "public"."subscription_invoices"("issueDate");

-- CreateIndex
CREATE INDEX "subscription_events_subscriptionId_idx" ON "public"."subscription_events"("subscriptionId");

-- CreateIndex
CREATE INDEX "subscription_events_eventType_idx" ON "public"."subscription_events"("eventType");

-- CreateIndex
CREATE INDEX "subscription_events_processingStatus_idx" ON "public"."subscription_events"("processingStatus");

-- CreateIndex
CREATE INDEX "subscription_events_createdAt_idx" ON "public"."subscription_events"("createdAt");

-- CreateIndex
CREATE INDEX "subscription_plans_pluginId_idx" ON "public"."subscription_plans"("pluginId");

-- CreateIndex
CREATE INDEX "subscription_plans_isActive_idx" ON "public"."subscription_plans"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_plans_pluginId_planId_key" ON "public"."subscription_plans"("pluginId", "planId");

-- CreateIndex
CREATE INDEX "email_logs_tenantId_idx" ON "public"."email_logs"("tenantId");

-- CreateIndex
CREATE INDEX "email_logs_pluginId_idx" ON "public"."email_logs"("pluginId");

-- CreateIndex
CREATE INDEX "email_logs_provider_idx" ON "public"."email_logs"("provider");

-- CreateIndex
CREATE INDEX "email_logs_status_idx" ON "public"."email_logs"("status");

-- CreateIndex
CREATE INDEX "email_logs_sentAt_idx" ON "public"."email_logs"("sentAt");

-- CreateIndex
CREATE INDEX "email_logs_messageId_idx" ON "public"."email_logs"("messageId");

-- CreateIndex
CREATE INDEX "email_logs_externalId_idx" ON "public"."email_logs"("externalId");

-- CreateIndex
CREATE INDEX "email_templates_tenantId_idx" ON "public"."email_templates"("tenantId");

-- CreateIndex
CREATE INDEX "email_templates_category_idx" ON "public"."email_templates"("category");

-- CreateIndex
CREATE UNIQUE INDEX "email_templates_tenantId_slug_key" ON "public"."email_templates"("tenantId", "slug");

-- CreateIndex
CREATE INDEX "email_queue_tenantId_idx" ON "public"."email_queue"("tenantId");

-- CreateIndex
CREATE INDEX "email_queue_status_idx" ON "public"."email_queue"("status");

-- CreateIndex
CREATE INDEX "email_queue_scheduledAt_idx" ON "public"."email_queue"("scheduledAt");

-- CreateIndex
CREATE INDEX "email_queue_priority_idx" ON "public"."email_queue"("priority");

-- AddForeignKey
ALTER TABLE "public"."users" ADD CONSTRAINT "users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."products" ADD CONSTRAINT "products_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_items" ADD CONSTRAINT "order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_items" ADD CONSTRAINT "order_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_items" ADD CONSTRAINT "order_items_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."inventory_reservations" ADD CONSTRAINT "inventory_reservations_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."inventory_reservations" ADD CONSTRAINT "inventory_reservations_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."inventory_reservations" ADD CONSTRAINT "inventory_reservations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."carts" ADD CONSTRAINT "carts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."carts" ADD CONSTRAINT "carts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cart_items" ADD CONSTRAINT "cart_items_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "public"."carts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cart_items" ADD CONSTRAINT "cart_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cart_items" ADD CONSTRAINT "cart_items_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."price_controls" ADD CONSTRAINT "price_controls_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tenant_pricing" ADD CONSTRAINT "tenant_pricing_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tenant_pricing" ADD CONSTRAINT "tenant_pricing_priceControlId_fkey" FOREIGN KEY ("priceControlId") REFERENCES "public"."price_controls"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tenant_data_sync" ADD CONSTRAINT "tenant_data_sync_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."audit_logs" ADD CONSTRAINT "audit_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."social_accounts" ADD CONSTRAINT "social_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."oauth2_access_tokens" ADD CONSTRAINT "oauth2_access_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."plugin_installations" ADD CONSTRAINT "plugin_installations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."plugin_installations" ADD CONSTRAINT "plugin_installations_pluginId_fkey" FOREIGN KEY ("pluginId") REFERENCES "public"."plugins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."plugin_usage" ADD CONSTRAINT "plugin_usage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payments" ADD CONSTRAINT "payments_pluginId_fkey" FOREIGN KEY ("pluginId") REFERENCES "public"."plugins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payments" ADD CONSTRAINT "payments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payments" ADD CONSTRAINT "payments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tenant_custom_pricing" ADD CONSTRAINT "tenant_custom_pricing_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tenant_custom_pricing" ADD CONSTRAINT "tenant_custom_pricing_pluginId_fkey" FOREIGN KEY ("pluginId") REFERENCES "public"."plugins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tenant_feature_overrides" ADD CONSTRAINT "tenant_feature_overrides_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tenant_usage_overrides" ADD CONSTRAINT "tenant_usage_overrides_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."subscriptions" ADD CONSTRAINT "subscriptions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."subscriptions" ADD CONSTRAINT "subscriptions_pluginId_fkey" FOREIGN KEY ("pluginId") REFERENCES "public"."plugins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."subscription_changes" ADD CONSTRAINT "subscription_changes_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "public"."subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."subscription_invoices" ADD CONSTRAINT "subscription_invoices_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "public"."subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."subscription_events" ADD CONSTRAINT "subscription_events_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "public"."subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."subscription_plans" ADD CONSTRAINT "subscription_plans_pluginId_fkey" FOREIGN KEY ("pluginId") REFERENCES "public"."plugins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."email_logs" ADD CONSTRAINT "email_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."email_logs" ADD CONSTRAINT "email_logs_pluginId_fkey" FOREIGN KEY ("pluginId") REFERENCES "public"."plugins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."email_templates" ADD CONSTRAINT "email_templates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."email_queue" ADD CONSTRAINT "email_queue_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
