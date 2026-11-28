-- Storefront traffic collection: one row per visit with the acquisition fields
-- it arrived with, page views per path per day, and the channel rules document.
-- Nothing personal is stored; visitorKey is a monthly-rotated HMAC.

-- CreateTable
CREATE TABLE "traffic_sessions" (
    "id" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "visitorKey" TEXT NOT NULL,
    "startedAt" BIGINT NOT NULL,
    "lastSeenAt" BIGINT NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 1,
    "landingPath" TEXT NOT NULL,
    "referrerHost" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmContent" TEXT,
    "utmTerm" TEXT,
    "clickIds" TEXT,
    "country" TEXT,
    "device" TEXT,

    CONSTRAINT "traffic_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "traffic_page_daily" (
    "day" INTEGER NOT NULL,
    "host" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "traffic_page_daily_pkey" PRIMARY KEY ("day","host","path")
);

-- CreateTable
CREATE TABLE "traffic_channel_rules" (
    "id" INTEGER NOT NULL,
    "rulesJson" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "traffic_channel_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "traffic_sessions_startedAt_idx" ON "traffic_sessions"("startedAt");

-- CreateIndex
CREATE INDEX "traffic_sessions_visitorKey_lastSeenAt_idx" ON "traffic_sessions"("visitorKey", "lastSeenAt");
