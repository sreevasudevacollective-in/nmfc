-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('PENDING_REVIEW', 'REJECTED', 'ACCEPTED', 'WITHDRAWN');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "authUid" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FighterProfile" (
    "id" TEXT NOT NULL,
    "fighterId" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "emergencyName" TEXT,
    "emergencyPhone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FighterProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FighterApplication" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "nickname" TEXT,
    "dob" TIMESTAMP(3),
    "weightClass" "WeightClass",
    "heightCm" INTEGER,
    "reachCm" INTEGER,
    "gym" TEXT,
    "hometown" TEXT,
    "instagram" TEXT,
    "bio" TEXT,
    "photoKey" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "reviewerUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "fighterId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FighterApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "before" TEXT,
    "after" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Fighter" ADD COLUMN "slug" TEXT,
ADD COLUMN "priorWins" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "priorLosses" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "priorDraws" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "gym" TEXT,
ADD COLUMN "hometown" TEXT,
ADD COLUMN "instagram" TEXT,
ADD COLUMN "photoKey" TEXT,
ADD COLUMN "userId" TEXT;

UPDATE "Fighter" SET "slug" = lower("firstName") || '-' || lower("lastName") || '-' || substr("id", 1, 8) WHERE "slug" IS NULL;

ALTER TABLE "Fighter" ALTER COLUMN "slug" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_authUid_key" ON "User"("authUid");

-- CreateIndex
CREATE UNIQUE INDEX "Fighter_slug_key" ON "Fighter"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Fighter_userId_key" ON "Fighter"("userId");

-- CreateIndex
CREATE INDEX "Fighter_weightClass_idx" ON "Fighter"("weightClass");

-- CreateIndex
CREATE UNIQUE INDEX "FighterProfile_fighterId_key" ON "FighterProfile"("fighterId");

-- CreateIndex
CREATE UNIQUE INDEX "FighterApplication_fighterId_key" ON "FighterApplication"("fighterId");

-- CreateIndex
CREATE INDEX "FighterApplication_status_idx" ON "FighterApplication"("status");

-- CreateIndex
CREATE INDEX "FighterApplication_userId_idx" ON "FighterApplication"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "Fight_eventId_idx" ON "Fight"("eventId");

-- AddForeignKey
ALTER TABLE "Fighter" ADD CONSTRAINT "Fighter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FighterProfile" ADD CONSTRAINT "FighterProfile_fighterId_fkey" FOREIGN KEY ("fighterId") REFERENCES "Fighter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FighterApplication" ADD CONSTRAINT "FighterApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FighterApplication" ADD CONSTRAINT "FighterApplication_reviewerUserId_fkey" FOREIGN KEY ("reviewerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FighterApplication" ADD CONSTRAINT "FighterApplication_fighterId_fkey" FOREIGN KEY ("fighterId") REFERENCES "Fighter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
