-- Schema revisions from docs/system-design.md §3.2/§3.3 and ADR 0003.
--
-- Written by hand rather than generated, because the generated diff is not safe on a
-- populated database: it adds NOT NULL slugs to tables that already have rows, and drops
-- `Fight.winnerId` and `Fighter.wins/losses/draws` before their meaning has been carried
-- into the replacement columns. Each destructive step below is preceded by its backfill.

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FightStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FightOutcome" AS ENUM ('WIN_A', 'WIN_B', 'DRAW', 'NO_CONTEST');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'FIGHTER');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('UNCLAIMED', 'INVITED', 'CLAIMED');

-- ---------------------------------------------------------------------------
-- Fight: explicit status/outcome, backfilled from the old nullable winnerId
-- ---------------------------------------------------------------------------

ALTER TABLE "Fight" ADD COLUMN "status" "FightStatus" NOT NULL DEFAULT 'SCHEDULED';
ALTER TABLE "Fight" ADD COLUMN "outcome" "FightOutcome";
ALTER TABLE "Fight" ADD COLUMN "boutOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Fight" ADD COLUMN "isTitleFight" BOOLEAN NOT NULL DEFAULT false;

-- The old model could not distinguish "draw" from "not yet fought" — both had a null
-- winner. Best available reading: a recorded method means the bout happened.
UPDATE "Fight" SET
  "status" = 'COMPLETED',
  "outcome" = CASE
    WHEN "winnerId" = "fighterAId" THEN 'WIN_A'::"FightOutcome"
    WHEN "winnerId" = "fighterBId" THEN 'WIN_B'::"FightOutcome"
    ELSE 'DRAW'::"FightOutcome"
  END
WHERE "winnerId" IS NOT NULL OR "method" IS NOT NULL;

-- Order bouts within each event by creation, so existing cards have a stable order
-- instead of every bout sharing boutOrder 0.
UPDATE "Fight" f SET "boutOrder" = s.rn
FROM (
  SELECT "id", row_number() OVER (PARTITION BY "eventId" ORDER BY "createdAt", "id") AS rn
  FROM "Fight"
) s
WHERE s."id" = f."id";

-- ---------------------------------------------------------------------------
-- Fighter: stored record -> prior-promotion record (§3.3)
-- ---------------------------------------------------------------------------
-- wins/losses/draws previously held a fighter's whole career record. The NMFC portion is
-- now derived from Fight rows, so only the pre-NMFC remainder may be stored — subtract
-- what our own fight table already accounts for, or the displayed record double-counts.

ALTER TABLE "Fighter" ADD COLUMN "priorWins" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Fighter" ADD COLUMN "priorLosses" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Fighter" ADD COLUMN "priorDraws" INTEGER NOT NULL DEFAULT 0;

UPDATE "Fighter" f SET
  "priorWins" = GREATEST(0, f."wins" - (
    SELECT count(*) FROM "Fight" ft
    WHERE ft."status" = 'COMPLETED'
      AND ((ft."outcome" = 'WIN_A' AND ft."fighterAId" = f."id")
        OR (ft."outcome" = 'WIN_B' AND ft."fighterBId" = f."id"))
  )),
  "priorLosses" = GREATEST(0, f."losses" - (
    SELECT count(*) FROM "Fight" ft
    WHERE ft."status" = 'COMPLETED'
      AND ((ft."outcome" = 'WIN_B' AND ft."fighterAId" = f."id")
        OR (ft."outcome" = 'WIN_A' AND ft."fighterBId" = f."id"))
  )),
  "priorDraws" = GREATEST(0, f."draws" - (
    SELECT count(*) FROM "Fight" ft
    WHERE ft."status" = 'COMPLETED' AND ft."outcome" = 'DRAW'
      AND (ft."fighterAId" = f."id" OR ft."fighterBId" = f."id")
  ));

-- Now safe to drop the replaced columns.
ALTER TABLE "Fight" DROP COLUMN "winnerId";
ALTER TABLE "Fighter" DROP COLUMN "wins";
ALTER TABLE "Fighter" DROP COLUMN "losses";
ALTER TABLE "Fighter" DROP COLUMN "draws";

-- photoUrl held a full URL; photoKey holds a storage key (§7). The values are not
-- interchangeable, so this is a drop-and-add rather than a rename — any existing URLs
-- must be re-uploaded through the presigned-upload path.
ALTER TABLE "Fighter" DROP COLUMN "photoUrl";
ALTER TABLE "Fighter" ADD COLUMN "photoKey" TEXT;

-- ---------------------------------------------------------------------------
-- Fighter: profile fields and account binding (ADR 0003)
-- ---------------------------------------------------------------------------

ALTER TABLE "Fighter" ADD COLUMN "gym" TEXT;
ALTER TABLE "Fighter" ADD COLUMN "hometown" TEXT;
ALTER TABLE "Fighter" ADD COLUMN "instagramUrl" TEXT;
ALTER TABLE "Fighter" ADD COLUMN "facebookUrl" TEXT;
ALTER TABLE "Fighter" ADD COLUMN "xUrl" TEXT;
ALTER TABLE "Fighter" ADD COLUMN "userId" TEXT;
ALTER TABLE "Fighter" ADD COLUMN "claimStatus" "ClaimStatus" NOT NULL DEFAULT 'UNCLAIMED';

-- ---------------------------------------------------------------------------
-- Slugs (§3.2) — added nullable, backfilled, then constrained
-- ---------------------------------------------------------------------------

ALTER TABLE "Fighter" ADD COLUMN "slug" TEXT;

UPDATE "Fighter" f SET "slug" = s.base || CASE WHEN s.rn = 1 THEN '' ELSE '-' || s.rn END
FROM (
  SELECT "id", base, row_number() OVER (PARTITION BY base ORDER BY "createdAt", "id") AS rn
  FROM (
    SELECT "id", "createdAt",
      COALESCE(
        NULLIF(trim(BOTH '-' FROM regexp_replace(lower("firstName" || ' ' || "lastName"), '[^a-z0-9]+', '-', 'g')), ''),
        'fighter'
      ) AS base
    FROM "Fighter"
  ) b
) s
WHERE s."id" = f."id";

ALTER TABLE "Fighter" ALTER COLUMN "slug" SET NOT NULL;

ALTER TABLE "Event" ADD COLUMN "slug" TEXT;

UPDATE "Event" e SET "slug" = s.base || CASE WHEN s.rn = 1 THEN '' ELSE '-' || s.rn END
FROM (
  SELECT "id", base, row_number() OVER (PARTITION BY base ORDER BY "createdAt", "id") AS rn
  FROM (
    SELECT "id", "createdAt",
      COALESCE(
        NULLIF(trim(BOTH '-' FROM regexp_replace(lower("name"), '[^a-z0-9]+', '-', 'g')), ''),
        'event'
      ) AS base
    FROM "Event"
  ) b
) s
WHERE s."id" = e."id";

ALTER TABLE "Event" ALTER COLUMN "slug" SET NOT NULL;

-- ---------------------------------------------------------------------------
-- Event: free-form status string -> enum
-- ---------------------------------------------------------------------------

ALTER TABLE "Event" ADD COLUMN "statusEnum" "EventStatus" NOT NULL DEFAULT 'SCHEDULED';

UPDATE "Event" SET "statusEnum" = CASE upper(trim("status"))
  WHEN 'COMPLETED' THEN 'COMPLETED'::"EventStatus"
  WHEN 'CANCELLED' THEN 'CANCELLED'::"EventStatus"
  WHEN 'CANCELED'  THEN 'CANCELLED'::"EventStatus"
  ELSE 'SCHEDULED'::"EventStatus"
END;

ALTER TABLE "Event" DROP COLUMN "status";
ALTER TABLE "Event" RENAME COLUMN "statusEnum" TO "status";

ALTER TABLE "Event" ADD COLUMN "posterKey" TEXT;

-- ---------------------------------------------------------------------------
-- New tables
-- ---------------------------------------------------------------------------

CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'FIGHTER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FighterProfile" (
    "id" TEXT NOT NULL,
    "fighterId" TEXT NOT NULL,
    "phone" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postalCode" TEXT,
    "country" TEXT,
    "emergencyName" TEXT,
    "emergencyPhone" TEXT,
    "emergencyRelation" TEXT,
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FighterProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "before" TEXT,
    "after" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "FighterProfile_fighterId_key" ON "FighterProfile"("fighterId");
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

CREATE UNIQUE INDEX "Fighter_slug_key" ON "Fighter"("slug");
CREATE UNIQUE INDEX "Fighter_userId_key" ON "Fighter"("userId");
CREATE INDEX "Fighter_weightClass_idx" ON "Fighter"("weightClass");
CREATE INDEX "Fighter_lastName_idx" ON "Fighter"("lastName");

CREATE UNIQUE INDEX "Event_slug_key" ON "Event"("slug");
CREATE INDEX "Event_date_idx" ON "Event"("date");

CREATE INDEX "Fight_eventId_idx" ON "Fight"("eventId");
CREATE INDEX "Fight_fighterAId_idx" ON "Fight"("fighterAId");
CREATE INDEX "Fight_fighterBId_idx" ON "Fight"("fighterBId");

-- Rank uniqueness is enforced in the service layer, not here: a unique index on
-- (weightClass, rank) makes any reorder collide mid-update (§3.2 item 4).
DROP INDEX "Ranking_weightClass_rank_key";
CREATE INDEX "Ranking_weightClass_rank_idx" ON "Ranking"("weightClass", "rank");
CREATE UNIQUE INDEX "Ranking_weightClass_fighterId_key" ON "Ranking"("weightClass", "fighterId");

-- ---------------------------------------------------------------------------
-- Foreign keys
-- ---------------------------------------------------------------------------

ALTER TABLE "Fighter" ADD CONSTRAINT "Fighter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FighterProfile" ADD CONSTRAINT "FighterProfile_fighterId_fkey" FOREIGN KEY ("fighterId") REFERENCES "Fighter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Deleting an event takes its card with it; deleting a fighter takes their ranking rows.
-- Fight->Fighter stays RESTRICT: a fighter with recorded bouts must not be deletable,
-- because those bouts are part of their opponents' records (ADR 0003).
ALTER TABLE "Fight" DROP CONSTRAINT "Fight_eventId_fkey";
ALTER TABLE "Fight" ADD CONSTRAINT "Fight_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Ranking" DROP CONSTRAINT "Ranking_fighterId_fkey";
ALTER TABLE "Ranking" ADD CONSTRAINT "Ranking_fighterId_fkey" FOREIGN KEY ("fighterId") REFERENCES "Fighter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
