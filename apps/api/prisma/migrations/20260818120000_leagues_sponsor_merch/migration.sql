-- CreateEnum
CREATE TYPE "LeagueKind" AS ENUM ('HOME', 'PARTNERED');

-- CreateTable
CREATE TABLE "League" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "LeagueKind" NOT NULL,
    "discipline" TEXT,
    "description" TEXT,
    "logoKey" TEXT,
    "websiteUrl" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "League_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "League_slug_key" ON "League"("slug");

-- CreateIndex
CREATE INDEX "League_kind_idx" ON "League"("kind");

-- CreateTable
CREATE TABLE "FighterLeague" (
    "fighterId" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FighterLeague_pkey" PRIMARY KEY ("fighterId","leagueId")
);

-- CreateIndex
CREATE INDEX "FighterLeague_leagueId_idx" ON "FighterLeague"("leagueId");

-- AddForeignKey
ALTER TABLE "FighterLeague" ADD CONSTRAINT "FighterLeague_fighterId_fkey" FOREIGN KEY ("fighterId") REFERENCES "Fighter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FighterLeague" ADD CONSTRAINT "FighterLeague_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed the three home leagues and the partnered-league directory placeholder.
-- Existing Event/Ranking rows predate the League concept and are backfilled onto
-- "No Mercy Fighting Championship" below, since every fighter/event seeded so far
-- is MMA-style.
INSERT INTO "League" ("id", "slug", "name", "kind", "discipline", "displayOrder", "updatedAt") VALUES
    ('league_nmfc',        'no-mercy-fighting-championship', 'No Mercy Fighting Championship', 'HOME', 'MMA',            0, CURRENT_TIMESTAMP),
    ('league_hand_to_hand','no-mercy-hand-to-hand',          'No Mercy Hand to Hand',          'HOME', 'Hand to Hand',   1, CURRENT_TIMESTAMP),
    ('league_slap_wars',   'no-mercy-slap-wars',             'No Mercy Slap Wars',             'HOME', 'Slap Fighting',  2, CURRENT_TIMESTAMP);

-- AlterTable: Event gets a required leagueId. Backfill existing rows onto the
-- flagship home league before the NOT NULL constraint is added, so the migration
-- runs cleanly against data that predates leagues.
ALTER TABLE "Event" ADD COLUMN "leagueId" TEXT;
UPDATE "Event" SET "leagueId" = 'league_nmfc' WHERE "leagueId" IS NULL;
ALTER TABLE "Event" ALTER COLUMN "leagueId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Event_leagueId_idx" ON "Event"("leagueId");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: Ranking gets a required leagueId, same backfill approach. The old
-- global (weightClass, rank) uniqueness is replaced by (leagueId, weightClass,
-- rank) — the same rank/class pair is now free to be reused across leagues.
ALTER TABLE "Ranking" ADD COLUMN "leagueId" TEXT;
UPDATE "Ranking" SET "leagueId" = 'league_nmfc' WHERE "leagueId" IS NULL;
ALTER TABLE "Ranking" ALTER COLUMN "leagueId" SET NOT NULL;

DROP INDEX IF EXISTS "Ranking_weightClass_rank_key";
CREATE UNIQUE INDEX "Ranking_leagueId_weightClass_rank_key" ON "Ranking"("leagueId", "weightClass", "rank");
CREATE INDEX "Ranking_leagueId_idx" ON "Ranking"("leagueId");

-- AddForeignKey
ALTER TABLE "Ranking" ADD CONSTRAINT "Ranking_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "SponsorInquiry" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organization" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "message" TEXT,
    "interestedPackage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SponsorInquiry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SponsorInquiry_createdAt_idx" ON "SponsorInquiry"("createdAt");

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priceInr" INTEGER,
    "imageKey" TEXT,
    "category" TEXT,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");

-- CreateIndex
CREATE INDEX "Product_category_idx" ON "Product"("category");
