-- CreateTable
CREATE TABLE "admin_list_views" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "listKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "query" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_list_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_list_column_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "listKey" TEXT NOT NULL,
    "columns" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_list_column_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "admin_list_views_userId_listKey_idx" ON "admin_list_views"("userId", "listKey");

-- CreateIndex
CREATE UNIQUE INDEX "admin_list_views_userId_listKey_name_key" ON "admin_list_views"("userId", "listKey", "name");

-- CreateIndex
CREATE INDEX "admin_list_column_preferences_userId_listKey_idx" ON "admin_list_column_preferences"("userId", "listKey");

-- CreateIndex
CREATE UNIQUE INDEX "admin_list_column_preferences_userId_listKey_key" ON "admin_list_column_preferences"("userId", "listKey");

-- AddForeignKey
ALTER TABLE "admin_list_views" ADD CONSTRAINT "admin_list_views_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_list_column_preferences" ADD CONSTRAINT "admin_list_column_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
