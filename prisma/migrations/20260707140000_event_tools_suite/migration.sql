-- Player-facing help desk requests.
CREATE TABLE "PlayerRequest" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tid" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'help',
  "playerName" TEXT,
  "tableNumber" TEXT,
  "message" TEXT,
  "status" TEXT NOT NULL DEFAULT 'open',
  "priority" TEXT NOT NULL DEFAULT 'normal',
  "assignedTo" TEXT,
  "internalNote" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  "acknowledgedAt" DATETIME,
  "resolvedAt" DATETIME
);

CREATE INDEX "PlayerRequest_tid_status_idx" ON "PlayerRequest"("tid", "status");
CREATE INDEX "PlayerRequest_tid_type_idx" ON "PlayerRequest"("tid", "type");
CREATE INDEX "PlayerRequest_tid_priority_idx" ON "PlayerRequest"("tid", "priority");
CREATE INDEX "PlayerRequest_tid_createdAt_idx" ON "PlayerRequest"("tid", "createdAt");

-- Staff assignments and floor ownership.
CREATE TABLE "StaffAssignment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tid" TEXT NOT NULL,
  "staffName" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'floor_judge',
  "zone" TEXT,
  "tableNumber" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active',
  "note" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE INDEX "StaffAssignment_tid_role_idx" ON "StaffAssignment"("tid", "role");
CREATE INDEX "StaffAssignment_tid_status_idx" ON "StaffAssignment"("tid", "status");

-- Private event incident log.
CREATE TABLE "IncidentLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tid" TEXT NOT NULL,
  "playerName" TEXT,
  "tableNumber" TEXT,
  "category" TEXT NOT NULL DEFAULT 'other',
  "severity" TEXT NOT NULL DEFAULT 'note',
  "summary" TEXT NOT NULL,
  "ruling" TEXT,
  "appealed" BOOLEAN NOT NULL DEFAULT false,
  "status" TEXT NOT NULL DEFAULT 'open',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE INDEX "IncidentLog_tid_category_idx" ON "IncidentLog"("tid", "category");
CREATE INDEX "IncidentLog_tid_status_idx" ON "IncidentLog"("tid", "status");
CREATE INDEX "IncidentLog_tid_createdAt_idx" ON "IncidentLog"("tid", "createdAt");

-- Broadcast runbook entries for stream production.
CREATE TABLE "BroadcastRunbookItem" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tid" TEXT NOT NULL,
  "segment" TEXT NOT NULL DEFAULT 'round',
  "title" TEXT NOT NULL,
  "body" TEXT,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "featureTable" TEXT,
  "lowerThird" TEXT,
  "sponsorLine" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE INDEX "BroadcastRunbookItem_tid_status_idx" ON "BroadcastRunbookItem"("tid", "status");
CREATE INDEX "BroadcastRunbookItem_tid_sortOrder_idx" ON "BroadcastRunbookItem"("tid", "sortOrder");

-- Timestamp markers for later clip editing.
CREATE TABLE "ClipMarker" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tid" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "note" TEXT,
  "roundLabel" TEXT,
  "tableNumber" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "ClipMarker_tid_createdAt_idx" ON "ClipMarker"("tid", "createdAt");
