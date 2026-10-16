
-- CreateTable
CREATE TABLE "rules_drafts" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "content" JSONB NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT NOT NULL,

    CONSTRAINT "rules_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rules_versions" (
    "id" SERIAL NOT NULL,
    "content" JSONB NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedBy" TEXT NOT NULL,

    CONSTRAINT "rules_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_overrides" (
    "locale" "Locale" NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT NOT NULL,

    CONSTRAINT "message_overrides_pkey" PRIMARY KEY ("locale","key")
);

-- CreateTable
CREATE TABLE "site_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "siteNamePlain" TEXT NOT NULL,
    "siteNameAccent" TEXT NOT NULL,
    "serverIp" TEXT NOT NULL,
    "discordUrl" TEXT NOT NULL,
    "supportEmail" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT NOT NULL,

    CONSTRAINT "site_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rules_versions_publishedAt_idx" ON "rules_versions"("publishedAt");

