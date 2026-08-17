-- Fighter applications (ADR 0004): open intake, reviewed before any Fighter exists.
--
-- Additive only. Application and its children are new tables; the new Fighter columns
-- are all nullable, so this is safe against populated data. The Role enum value this
-- depends on was added in the preceding migration and must stay separate.

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "Stance" AS ENUM ('ORTHODOX', 'SOUTHPAW', 'SWITCH');

-- CreateEnum
CREATE TYPE "Discipline" AS ENUM ('BOXING', 'MUAY_THAI', 'KICKBOXING', 'SANDA', 'KARATE', 'TAEKWONDO', 'MMA', 'BJJ', 'WRESTLING', 'OTHER');

-- CreateEnum
CREATE TYPE "ConditioningLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'ELITE');

-- CreateEnum
CREATE TYPE "FightAttribute" AS ENUM ('PUNCHING_POWER', 'HAND_SPEED', 'KICKING_POWER', 'KICKING_SPEED', 'FOOTWORK', 'COUNTER_STRIKING', 'COMBINATION_STRIKING', 'DEFENCE', 'FIGHT_IQ', 'CARDIO', 'DURABILITY', 'EXPLOSIVENESS', 'PRESSURE_FIGHTING', 'TECHNICAL_STRIKING');

-- CreateEnum
CREATE TYPE "VideoKind" AS ENUM ('FULL_FIGHT', 'HIGHLIGHT', 'PAD_WORK', 'HEAVY_BAG', 'SHADOWBOXING');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'SHORTLISTED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN');

-- AlterTable
ALTER TABLE "Fighter" ADD COLUMN     "applicationId" TEXT,
ADD COLUMN     "gender" "Gender",
ADD COLUMN     "primaryStyle" "Discipline",
ADD COLUMN     "secondaryStyle" "Discipline",
ADD COLUMN     "stance" "Stance";

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'APPLICANT';

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'DRAFT',
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "dob" TIMESTAMP(3) NOT NULL,
    "gender" "Gender" NOT NULL,
    "nationality" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT,
    "country" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "instagramUrl" TEXT,
    "facebookUrl" TEXT,
    "xUrl" TEXT,
    "emergencyName" TEXT NOT NULL,
    "emergencyPhone" TEXT NOT NULL,
    "emergencyRelation" TEXT,
    "nickname" TEXT,
    "primaryStyle" "Discipline" NOT NULL,
    "secondaryStyle" "Discipline",
    "desiredWeightClass" "WeightClass" NOT NULL,
    "heightCm" INTEGER NOT NULL,
    "reachCm" INTEGER NOT NULL,
    "walkingWeightKg" DECIMAL(5,2) NOT NULL,
    "competitionWeightKg" DECIMAL(5,2) NOT NULL,
    "legLengthCm" INTEGER,
    "stance" "Stance" NOT NULL,
    "yearsExperience" INTEGER NOT NULL,
    "trainingDaysPerWeek" INTEGER NOT NULL,
    "conditioning" "ConditioningLevel" NOT NULL,
    "gym" TEXT NOT NULL,
    "headCoach" TEXT NOT NULL,
    "coachPhone" TEXT,
    "coachEmail" TEXT,
    "claimedWins" INTEGER NOT NULL DEFAULT 0,
    "claimedLosses" INTEGER NOT NULL DEFAULT 0,
    "claimedDraws" INTEGER NOT NULL DEFAULT 0,
    "claimedKoWins" INTEGER NOT NULL DEFAULT 0,
    "claimedDecisionWins" INTEGER NOT NULL DEFAULT 0,
    "claimedSubmissionWins" INTEGER NOT NULL DEFAULT 0,
    "claimedAmateurRecord" TEXT,
    "claimedProRecord" TEXT,
    "lastFightDate" TIMESTAMP(3),
    "nextFightDate" TIMESTAMP(3),
    "honours" TEXT,
    "currentPromotion" TEXT,
    "medicallyCleared" BOOLEAN NOT NULL,
    "underSuspension" BOOLEAN NOT NULL,
    "contractualRestriction" BOOLEAN NOT NULL,
    "willingMedicalScreening" BOOLEAN NOT NULL,
    "willingScouting" BOOLEAN NOT NULL,
    "willingSparringEvaluation" BOOLEAN NOT NULL,
    "willingComplyRules" BOOLEAN NOT NULL,
    "willingAccurateRecords" BOOLEAN NOT NULL,
    "attributes" "FightAttribute"[],
    "coachYearsWithFighter" INTEGER,
    "coachAssessment" TEXT,
    "coachVerifiedRecord" BOOLEAN NOT NULL DEFAULT false,
    "declaredAccurate" BOOLEAN NOT NULL DEFAULT false,
    "ackIndependentMedical" BOOLEAN NOT NULL DEFAULT false,
    "ackNoGuarantee" BOOLEAN NOT NULL DEFAULT false,
    "agreedSafetyRules" BOOLEAN NOT NULL DEFAULT false,
    "declarationsAcceptedAt" TIMESTAMP(3),
    "motivation" TEXT,
    "careerGoals" TEXT,
    "differentiator" TEXT,
    "influence" TEXT,
    "willingToRelocate" BOOLEAN NOT NULL DEFAULT false,
    "submittedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationExperience" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "discipline" "Discipline" NOT NULL,
    "years" INTEGER NOT NULL,
    "record" TEXT,
    "notes" TEXT,

    CONSTRAINT "ApplicationExperience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationVideo" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "kind" "VideoKind" NOT NULL,
    "url" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationVideo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Application_userId_idx" ON "Application"("userId");

-- CreateIndex
CREATE INDEX "Application_status_submittedAt_idx" ON "Application"("status", "submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationExperience_applicationId_discipline_key" ON "ApplicationExperience"("applicationId", "discipline");

-- CreateIndex
CREATE INDEX "ApplicationVideo_applicationId_idx" ON "ApplicationVideo"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "Fighter_applicationId_key" ON "Fighter"("applicationId");

-- AddForeignKey
ALTER TABLE "Fighter" ADD CONSTRAINT "Fighter_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationExperience" ADD CONSTRAINT "ApplicationExperience_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationVideo" ADD CONSTRAINT "ApplicationVideo_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

