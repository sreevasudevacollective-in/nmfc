-- AlterTable
ALTER TABLE "FighterApplication" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
ALTER TABLE "FighterApplication" ADD COLUMN "draftStep" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "FighterApplication" ALTER COLUMN "firstName" DROP NOT NULL;
ALTER TABLE "FighterApplication" ALTER COLUMN "lastName" DROP NOT NULL;
