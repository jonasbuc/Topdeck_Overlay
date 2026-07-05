-- CreateTable: ParkingCache
-- Caches parking results per venue location (TTL enforced at app layer)
CREATE TABLE "ParkingCache" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cacheKey" TEXT NOT NULL,
    "lat" REAL NOT NULL,
    "lng" REAL NOT NULL,
    "provider" TEXT NOT NULL,
    "results" TEXT NOT NULL,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL
);

-- CreateTable: DiscordLink
-- Maps a TopDeck tournament to a Discord guild + channel
CREATE TABLE "DiscordLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tid" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "settings" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "ParkingCache_cacheKey_key" ON "ParkingCache"("cacheKey");

-- CreateIndex
CREATE INDEX "ParkingCache_expiresAt_idx" ON "ParkingCache"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "DiscordLink_tid_key" ON "DiscordLink"("tid");

-- CreateIndex
CREATE INDEX "DiscordLink_guildId_idx" ON "DiscordLink"("guildId");

-- CreateIndex
CREATE INDEX "DiscordLink_channelId_idx" ON "DiscordLink"("channelId");
