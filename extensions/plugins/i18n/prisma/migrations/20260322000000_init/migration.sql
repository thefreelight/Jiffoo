-- CreateTable
CREATE TABLE "content_translations" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "sourceDigest" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ui_translations" (
    "id" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "namespace" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ui_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "managed_languages" (
    "id" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nativeName" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "fallbackTo" TEXT,
    "direction" TEXT NOT NULL DEFAULT 'ltr',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "managed_languages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "translation_jobs" (
    "id" TEXT NOT NULL,
    "targetLocale" TEXT NOT NULL,
    "entityType" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'manual',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "totalKeys" INTEGER NOT NULL DEFAULT 0,
    "doneKeys" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "translation_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "content_translations_entityType_entityId_locale_field_key" ON "content_translations"("entityType", "entityId", "locale", "field");

-- CreateIndex
CREATE INDEX "content_translations_entityType_entityId_locale_idx" ON "content_translations"("entityType", "entityId", "locale");

-- CreateIndex
CREATE INDEX "content_translations_entityType_locale_idx" ON "content_translations"("entityType", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "ui_translations_locale_namespace_key_key" ON "ui_translations"("locale", "namespace", "key");

-- CreateIndex
CREATE INDEX "ui_translations_locale_namespace_idx" ON "ui_translations"("locale", "namespace");

-- CreateIndex
CREATE UNIQUE INDEX "managed_languages_locale_key" ON "managed_languages"("locale");

-- CreateIndex
CREATE INDEX "translation_jobs_status_idx" ON "translation_jobs"("status");
