/*
  Warnings:

  - You are about to drop the column `pairings` on the `TournamentState` table. All the data in the column will be lost.
  - You are about to drop the column `roundLengthSec` on the `TournamentState` table. All the data in the column will be lost.
  - You are about to drop the column `roundTimerStart` on the `TournamentState` table. All the data in the column will be lost.
  - You are about to drop the column `winner` on the `TournamentState` table. All the data in the column will be lost.
  - You are about to alter the column `currentStage` on the `TournamentState` table. The data in that column could be lost. The data in that column will be cast from `String` to `Int`.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TournamentState" (
    "tid" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL DEFAULT '',
    "game" TEXT NOT NULL DEFAULT '',
    "format" TEXT NOT NULL DEFAULT '',
    "startDate" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Not Started',
    "location" TEXT,
    "headerImage" TEXT,
    "currentStage" INTEGER NOT NULL DEFAULT 0,
    "currentRound" INTEGER NOT NULL DEFAULT 0,
    "roundLabel" TEXT NOT NULL DEFAULT '',
    "roundStatus" TEXT NOT NULL DEFAULT 'pending',
    "roundStartedAt" TEXT,
    "roundTimeMinutes" INTEGER,
    "tables" TEXT NOT NULL DEFAULT '[]',
    "matchResults" TEXT NOT NULL DEFAULT '[]',
    "standings" TEXT NOT NULL DEFAULT '[]',
    "players" TEXT NOT NULL DEFAULT '[]',
    "droppedPlayers" TEXT NOT NULL DEFAULT '[]',
    "waitlistPlayers" TEXT NOT NULL DEFAULT '[]',
    "checkinStarted" BOOLEAN NOT NULL DEFAULT false,
    "checkinStage" INTEGER,
    "finished" BOOLEAN NOT NULL DEFAULT false,
    "finishedAt" TEXT,
    "winnerData" TEXT,
    "participantCount" INTEGER,
    "lastEventId" TEXT NOT NULL DEFAULT '',
    "lastEventCreated" TEXT NOT NULL DEFAULT '0',
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_TournamentState" ("checkinStarted", "currentRound", "currentStage", "droppedPlayers", "finished", "format", "game", "lastEventId", "matchResults", "name", "participantCount", "players", "roundLabel", "roundStatus", "standings", "tid", "updatedAt") SELECT "checkinStarted", "currentRound", "currentStage", "droppedPlayers", "finished", "format", "game", "lastEventId", "matchResults", "name", "participantCount", "players", "roundLabel", "roundStatus", "standings", "tid", "updatedAt" FROM "TournamentState";
DROP TABLE "TournamentState";
ALTER TABLE "new_TournamentState" RENAME TO "TournamentState";
CREATE INDEX "TournamentState_finished_idx" ON "TournamentState"("finished");
CREATE INDEX "TournamentState_status_idx" ON "TournamentState"("status");
CREATE TABLE "new_WebhookEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tid" TEXT,
    "type" TEXT NOT NULL,
    "apiVersion" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL,
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rawPayload" TEXT NOT NULL
);
INSERT INTO "new_WebhookEvent" ("apiVersion", "createdAt", "id", "rawPayload", "receivedAt", "tid", "type") SELECT "apiVersion", "createdAt", "id", "rawPayload", "receivedAt", "tid", "type" FROM "WebhookEvent";
DROP TABLE "WebhookEvent";
ALTER TABLE "new_WebhookEvent" RENAME TO "WebhookEvent";
CREATE INDEX "WebhookEvent_tid_idx" ON "WebhookEvent"("tid");
CREATE INDEX "WebhookEvent_type_idx" ON "WebhookEvent"("type");
CREATE INDEX "WebhookEvent_createdAt_idx" ON "WebhookEvent"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
