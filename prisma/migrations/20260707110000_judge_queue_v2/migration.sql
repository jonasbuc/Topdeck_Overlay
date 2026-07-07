-- Judge queue V2: triage metadata for real event operations.

ALTER TABLE "JudgeCall" ADD COLUMN "category" TEXT NOT NULL DEFAULT 'rules';
ALTER TABLE "JudgeCall" ADD COLUMN "priority" TEXT NOT NULL DEFAULT 'normal';
ALTER TABLE "JudgeCall" ADD COLUMN "assignedTo" TEXT;
ALTER TABLE "JudgeCall" ADD COLUMN "internalNote" TEXT;
ALTER TABLE "JudgeCall" ADD COLUMN "acknowledgedAt" DATETIME;

CREATE INDEX "JudgeCall_tid_priority_idx" ON "JudgeCall"("tid", "priority");
