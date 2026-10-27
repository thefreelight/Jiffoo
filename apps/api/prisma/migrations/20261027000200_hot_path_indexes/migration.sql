-- CreateIndex
CREATE INDEX "orders_createdAt_idx" ON "orders"("createdAt");

-- CreateIndex
CREATE INDEX "orders_userId_createdAt_idx" ON "orders"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "order_status_history_orderId_createdAt_idx" ON "order_status_history"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "users_username_idx" ON "users"("username");

-- CreateIndex
CREATE INDEX "users_role_createdAt_idx" ON "users"("role", "createdAt");

-- CreateIndex
CREATE INDEX "categories_parentId_sortOrder_idx" ON "categories"("parentId", "sortOrder");

-- CreateIndex
CREATE INDEX "products_isActive_createdAt_idx" ON "products"("isActive", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_relatedType_relatedId_idx" ON "notifications"("relatedType", "relatedId");

-- CreateIndex
CREATE INDEX "notifications_resentFromId_idx" ON "notifications"("resentFromId");

-- CreateIndex
CREATE INDEX "admin_audit_events_createdAt_idx" ON "admin_audit_events"("createdAt");

-- CreateIndex
CREATE INDEX "admin_staff_audit_logs_createdAt_idx" ON "admin_staff_audit_logs"("createdAt");
