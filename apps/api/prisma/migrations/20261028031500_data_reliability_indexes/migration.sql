-- The scoped idempotency index is created before the global one is dropped, so the
-- table never loses its uniqueness, not even for a single statement.
-- CreateIndex
CREATE UNIQUE INDEX "orders_userId_idempotencyKey_key" ON "orders"("userId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "admin_audit_events_actorId_idx" ON "admin_audit_events"("actorId");

-- CreateIndex
CREATE INDEX "admin_audit_events_action_createdAt_idx" ON "admin_audit_events"("action", "createdAt");

-- CreateIndex
CREATE INDEX "admin_staff_audit_logs_actorUserId_createdAt_idx" ON "admin_staff_audit_logs"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "categories_sortOrder_id_idx" ON "categories"("sortOrder", "id");

-- CreateIndex
CREATE INDEX "notifications_resentFromId_createdAt_idx" ON "notifications"("resentFromId", "createdAt");

-- CreateIndex
CREATE INDEX "order_items_productId_idx" ON "order_items"("productId");

-- CreateIndex
CREATE INDEX "orders_paymentStatus_status_createdAt_idx" ON "orders"("paymentStatus", "status", "createdAt");

-- CreateIndex
CREATE INDEX "orders_status_createdAt_idx" ON "orders"("status", "createdAt");

-- CreateIndex
CREATE INDEX "orders_totalAmount_id_idx" ON "orders"("totalAmount", "id");

-- CreateIndex
CREATE INDEX "payments_orderId_createdAt_idx" ON "payments"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "payments_status_reviewResolution_idx" ON "payments"("status", "reviewResolution");

-- CreateIndex
CREATE INDEX "plugin_installations_instanceKey_enabled_deletedAt_idx" ON "plugin_installations"("instanceKey", "enabled", "deletedAt");

-- CreateIndex
CREATE INDEX "plugin_installs_installedAt_idx" ON "plugin_installs"("installedAt");

-- CreateIndex
CREATE INDEX "plugin_migration_operations_slug_phase_idx" ON "plugin_migration_operations"("slug", "phase");

-- CreateIndex
CREATE INDEX "plugin_page_sessions_principalId_idx" ON "plugin_page_sessions"("principalId");

-- CreateIndex
CREATE INDEX "product_variants_salePrice_idx" ON "product_variants"("salePrice");

-- CreateIndex
CREATE INDEX "product_variants_stock_idx" ON "product_variants"("stock");

-- CreateIndex
CREATE INDEX "product_variants_sortOrder_id_idx" ON "product_variants"("sortOrder", "id");

-- CreateIndex
CREATE INDEX "products_name_id_idx" ON "products"("name", "id");

-- CreateIndex
CREATE INDEX "products_updatedAt_id_idx" ON "products"("updatedAt", "id");

-- CreateIndex
CREATE INDEX "products_createdAt_id_idx" ON "products"("createdAt", "id");

-- CreateIndex
CREATE INDEX "shipments_orderId_shippedAt_idx" ON "shipments"("orderId", "shippedAt");

-- CreateIndex
CREATE INDEX "users_isActive_idx" ON "users"("isActive");

-- The single column indexes are dropped only after their composite replacements
-- exist, so no query loses its access path. A filter on the leading column of a
-- composite index is served by that composite, so the single column indexes on
-- "orders.status", "orders.paymentStatus" and "notifications.resentFromId" are
-- pure write cost from here on.
-- DropIndex
DROP INDEX "orders_status_idx";

-- DropIndex
DROP INDEX "orders_paymentStatus_idx";

-- DropIndex
DROP INDEX "notifications_resentFromId_idx";

-- DropIndex
DROP INDEX "orders_idempotencyKey_key";

-- Trigram search support.
--
-- The admin catalogue and customer searches run `ILIKE '%term%'` predicates, which a
-- btree index cannot serve. pg_trgm provides the GIN operator class for it.
--
-- The extension is created before the indexes that depend on it, and the indexes
-- are partial on `IS NOT NULL` so that they stay invisible to the Prisma schema
-- engine: a partial index is skipped by its introspection, while a plain GIN
-- index would be reported as a migration drift against the datamodel. The
-- predicate is implied by every `ILIKE` search, so the planner still uses the
-- index for the substring lookup.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "products_name_trgm_idx" ON "products" USING gin ("name" gin_trgm_ops) WHERE "name" IS NOT NULL;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "products_description_trgm_idx" ON "products" USING gin ("description" gin_trgm_ops) WHERE "description" IS NOT NULL;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "products_spuCode_trgm_idx" ON "products" USING gin ("spuCode" gin_trgm_ops) WHERE "spuCode" IS NOT NULL;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "orders_orderNumber_trgm_idx" ON "orders" USING gin ("order_number" gin_trgm_ops) WHERE "order_number" IS NOT NULL;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "users_email_trgm_idx" ON "users" USING gin ("email" gin_trgm_ops) WHERE "email" IS NOT NULL;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "users_username_trgm_idx" ON "users" USING gin ("username" gin_trgm_ops) WHERE "username" IS NOT NULL;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "product_variants_skuCode_trgm_idx" ON "product_variants" USING gin ("skuCode" gin_trgm_ops) WHERE "skuCode" IS NOT NULL;

-- The refund review reads the accepted captures of one order that still owe a refund.
-- CreateIndex
CREATE INDEX IF NOT EXISTS "payment_ledger_succeeded_refund_required_idx" ON "payment_ledger" ("orderId") WHERE "eventType" = 'SUCCEEDED' AND "refundRequired" = true;

-- Negative stock, negative storage accounting and negative money are never valid.
-- The storage quota accounting already carries the "plugin_storage_quotas_nonnegative"
-- constraint, so only the remaining tables need one here.
-- AlterTable
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_stock_nonnegative" CHECK ("stock" >= 0);

-- AlterTable
ALTER TABLE "orders" ADD CONSTRAINT "orders_amounts_nonnegative" CHECK ("totalAmount" >= 0 AND "subtotalAmount" >= 0 AND "shippingAmount" >= 0 AND "taxAmount" >= 0);

-- AlterTable
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_attempts_nonnegative" CHECK ("attempts" >= 0);
