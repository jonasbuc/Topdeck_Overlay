-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tid" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "apiVersion" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL,
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rawPayload" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "TournamentState" (
    "tid" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL DEFAULT '',
    "game" TEXT NOT NULL DEFAULT '',
    "format" TEXT NOT NULL DEFAULT '',
    "currentStage" TEXT NOT NULL DEFAULT '',
    "currentRound" INTEGER NOT NULL DEFAULT 0,
    "roundLabel" TEXT NOT NULL DEFAULT '',
    "roundStatus" TEXT NOT NULL DEFAULT 'pending',
    "roundTimerStart" TEXT,
    "roundLengthSec" INTEGER NOT NULL DEFAULT 0,
    "pairings" TEXT NOT NULL DEFAULT '[]',
    "matchResults" TEXT NOT NULL DEFAULT '[]',
    "standings" TEXT NOT NULL DEFAULT '[]',
    "players" TEXT NOT NULL DEFAULT '[]',
    "droppedPlayers" TEXT NOT NULL DEFAULT '[]',
    "checkinStarted" BOOLEAN NOT NULL DEFAULT false,
    "finished" BOOLEAN NOT NULL DEFAULT false,
    "winner" TEXT,
    "participantCount" INTEGER NOT NULL DEFAULT 0,
    "lastEventId" TEXT NOT NULL DEFAULT '',
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "WebhookEvent_tid_idx" ON "WebhookEvent"("tid");

-- CreateIndex
CREATE INDEX "WebhookEvent_type_idx" ON "WebhookEvent"("type");

-- CreateIndex
CREATE INDEX "WebhookEvent_createdAt_idx" ON "WebhookEvent"("createdAt");

-- CreateIndex
CREATE INDEX "TournamentState_finished_idx" ON "TournamentState"("finished");
