-- AlterTable
-- Nullable: pre-existing applications submitted before intake asked which league
-- (see ADR 0006's Revisit note) have none. Every application submitted from here on
-- is required to have one -- enforced in the API at submit time, not by the database,
-- since a draft in progress legitimately has no league chosen yet.
ALTER TABLE "FighterApplication" ADD COLUMN "leagueId" TEXT;

-- AddForeignKey
ALTER TABLE "FighterApplication" ADD CONSTRAINT "FighterApplication_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE SET NULL ON UPDATE CASCADE;
