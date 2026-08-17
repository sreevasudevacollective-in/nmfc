-- Adds APPLICANT to the Role enum, alone, in its own migration.
--
-- Postgres will not let a newly added enum value be *used* in the transaction that added
-- it ("unsafe use of new value ... New enum values must be committed before they can be
-- used"). The next migration sets User.role's default to APPLICANT, so the ADD VALUE has
-- to commit first. Do not merge these two migrations.
ALTER TYPE "Role" ADD VALUE 'APPLICANT';
