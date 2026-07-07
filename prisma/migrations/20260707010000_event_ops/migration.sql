-- Event operations tools: announcements, judge calls, and floor map.

CREATE TABLE "TournamentAnnouncement" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tid" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "tone" TEXT NOT NULL DEFAULT 'info',
  "audience" TEXT NOT NULL DEFAULT 'all',
  "pinned" BOOLEAN NOT NULL DEFAULT true,
  "publishedToDiscordAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE INDEX "TournamentAnnouncement_tid_createdAt_idx"
  ON "TournamentAnnouncement"("tid", "createdAt");

CREATE INDEX "TournamentAnnouncement_tid_pinned_idx"
  ON "TournamentAnnouncement"("tid", "pinned");

CREATE TABLE "JudgeCall" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tid" TEXT NOT NULL,
  "tableNumber" TEXT,
  "playerName" TEXT,
  "message" TEXT,
  "status" TEXT NOT NULL DEFAULT 'open',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  "resolvedAt" DATETIME
);

CREATE INDEX "JudgeCall_tid_status_idx"
  ON "JudgeCall"("tid", "status");

CREATE INDEX "JudgeCall_tid_createdAt_idx"
  ON "JudgeCall"("tid", "createdAt");

CREATE TABLE "TournamentFloorMap" (
  "tid" TEXT NOT NULL PRIMARY KEY,
  "title" TEXT NOT NULL DEFAULT 'Venue floor map',
  "zones" TEXT NOT NULL DEFAULT '[]',
  "notes" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
