-- DEFERRED outcome, development feedback, and retention timestamps (ADR 0004).
--
-- Additive: one new enum value plus nullable columns. The new ApplicationStatus
-- value is safe in this transaction because nothing here uses it — no default
-- references DEFERRED. Contrast the Role/APPLICANT split in 20260817070000.

-- AlterEnum
ALTER TYPE "ApplicationStatus" ADD VALUE 'DEFERRED';

-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "developmentFeedback" TEXT,
ADD COLUMN     "minimisedAt" TIMESTAMP(3),
ADD COLUMN     "retainUntil" TIMESTAMP(3),
ADD COLUMN     "revisitAfter" TIMESTAMP(3);

