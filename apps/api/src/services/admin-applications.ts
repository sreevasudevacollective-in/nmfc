import type { ApplicationStatus } from "@prisma/client";
import type { AuthUser } from "../auth/firebase.js";
import { prisma } from "../db/prisma.js";
import { ensureUser } from "./users.js";
import { toApplicationJson } from "./applications.js";

const validStatuses = new Set<ApplicationStatus>([
  "DRAFT",
  "PENDING_REVIEW",
  "REJECTED",
  "ACCEPTED",
  "WITHDRAWN",
]);

export async function listApplications(status?: string) {
  const where =
    status && validStatuses.has(status as ApplicationStatus)
      ? { status: status as ApplicationStatus }
      : { status: { not: "DRAFT" as ApplicationStatus } };

  const rows = await prisma.fighterApplication.findMany({
    where,
    orderBy: { updatedAt: "desc" },
  });

  return rows.map((row) => ({
    ...toApplicationJson(row),
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    reviewNotes: row.reviewNotes ?? "",
    fighterId: row.fighterId,
  }));
}

async function uniqueSlug(firstName: string, lastName: string) {
  const base = `${firstName}-${lastName}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  let slug = base;
  let suffix = 2;
  while (await prisma.fighter.findUnique({ where: { slug } })) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }
  return slug;
}

// Every accepted fighter is affiliated with the flagship home league. The
// application form doesn't yet ask which league (Fighting Championship / Hand to
// Hand / Slap Wars) an applicant is trying out for, so there is no signal to place
// them elsewhere. Revisit once intake captures that choice.
const DEFAULT_LEAGUE_SLUG = "no-mercy-fighting-championship";

export async function acceptApplication(auth: AuthUser, applicationId: string) {
  const reviewer = await ensureUser(auth);

  const application = await prisma.fighterApplication.findUnique({ where: { id: applicationId } });
  if (!application) {
    return { ok: false as const, statusCode: 404 as const, error: "Application not found." };
  }
  if (application.status !== "PENDING_REVIEW") {
    return {
      ok: false as const,
      statusCode: 409 as const,
      error: `Application is ${application.status.toLowerCase().replace("_", " ")}, not pending review.`,
    };
  }
  if (!application.firstName || !application.lastName) {
    return { ok: false as const, statusCode: 400 as const, error: "Application is missing a name." };
  }

  const league = await prisma.league.findUnique({ where: { slug: DEFAULT_LEAGUE_SLUG } });
  if (!league) {
    return { ok: false as const, statusCode: 500 as const, error: "Default league is not seeded." };
  }

  const slug = await uniqueSlug(application.firstName, application.lastName);

  const fighter = await prisma.$transaction(async (tx) => {
    const created = await tx.fighter.create({
      data: {
        slug,
        firstName: application.firstName!,
        lastName: application.lastName!,
        nickname: application.nickname,
        dob: application.dob,
        weightClass: application.weightClass,
        heightCm: application.heightCm,
        reachCm: application.reachCm,
        gym: application.gym,
        hometown: application.hometown,
        instagram: application.instagram,
        bio: application.bio,
        photoKey: application.photoKey,
        userId: application.userId,
      },
    });

    if (application.phone || application.address) {
      await tx.fighterProfile.create({
        data: { fighterId: created.id, phone: application.phone, address: application.address },
      });
    }

    await tx.fighterLeague.create({ data: { fighterId: created.id, leagueId: league.id } });

    await tx.fighterApplication.update({
      where: { id: application.id },
      data: {
        status: "ACCEPTED",
        fighterId: created.id,
        reviewerUserId: reviewer.id,
        reviewedAt: new Date(),
      },
    });

    return created;
  });

  return { ok: true as const, fighter: { id: fighter.id, slug: fighter.slug } };
}

export async function rejectApplication(auth: AuthUser, applicationId: string, reviewNotes?: string) {
  const reviewer = await ensureUser(auth);

  const application = await prisma.fighterApplication.findUnique({ where: { id: applicationId } });
  if (!application) {
    return { ok: false as const, statusCode: 404 as const, error: "Application not found." };
  }
  if (application.status !== "PENDING_REVIEW") {
    return {
      ok: false as const,
      statusCode: 409 as const,
      error: `Application is ${application.status.toLowerCase().replace("_", " ")}, not pending review.`,
    };
  }

  const updated = await prisma.fighterApplication.update({
    where: { id: application.id },
    data: {
      status: "REJECTED",
      reviewerUserId: reviewer.id,
      reviewedAt: new Date(),
      reviewNotes: reviewNotes || null,
    },
  });

  return { ok: true as const, application: toApplicationJson(updated) };
}
