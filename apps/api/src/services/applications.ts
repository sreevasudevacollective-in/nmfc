import type { FighterApplication } from "@prisma/client";
import type { AuthUser } from "../auth/firebase.js";
import type { ApplicationDraftBody } from "../schemas/application.js";
import { prisma } from "../db/prisma.js";

export function toApplicationJson(row: FighterApplication) {
  return {
    id: row.id,
    status: row.status,
    draftStep: row.draftStep,
    email: row.email,
    firstName: row.firstName ?? "",
    lastName: row.lastName ?? "",
    nickname: row.nickname ?? "",
    dob: row.dob ? row.dob.toISOString().slice(0, 10) : "",
    weightClass: row.weightClass ?? "",
    heightCm: row.heightCm ?? "",
    reachCm: row.reachCm ?? "",
    gym: row.gym ?? "",
    hometown: row.hometown ?? "",
    instagram: row.instagram ?? "",
    bio: row.bio ?? "",
    phone: row.phone ?? "",
    address: row.address ?? "",
  };
}

async function ensureUser(auth: AuthUser) {
  return prisma.user.upsert({
    where: { authUid: auth.uid },
    create: { authUid: auth.uid, role: "USER" },
    update: {},
  });
}

export async function getMyApplication(auth: AuthUser) {
  const user = await ensureUser(auth);
  const row = await prisma.fighterApplication.findFirst({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
  });
  return row ? toApplicationJson(row) : null;
}

export async function saveDraft(auth: AuthUser, body: ApplicationDraftBody) {
  const user = await ensureUser(auth);

  const blocking = await prisma.fighterApplication.findFirst({
    where: { userId: user.id, status: "PENDING_REVIEW" },
  });
  if (blocking) {
    return { ok: false as const, statusCode: 409 as const, error: "Your application is already under review." };
  }

  const accepted = await prisma.fighterApplication.findFirst({
    where: { userId: user.id, status: "ACCEPTED" },
  });
  if (accepted) {
    return { ok: false as const, statusCode: 409 as const, error: "You already have an accepted fighter profile." };
  }

  let draft = await prisma.fighterApplication.findFirst({
    where: { userId: user.id, status: "DRAFT" },
  });

  const data = {
    email: auth.email.toLowerCase(),
    draftStep: body.draftStep ?? draft?.draftStep ?? 1,
    firstName: body.firstName,
    lastName: body.lastName,
    nickname: body.nickname,
    dob: body.dob ? new Date(body.dob) : undefined,
    weightClass: body.weightClass,
    heightCm: body.heightCm,
    reachCm: body.reachCm,
    gym: body.gym,
    hometown: body.hometown,
    instagram: body.instagram,
    bio: body.bio,
    phone: body.phone,
    address: body.address,
  };

  if (!draft) {
    draft = await prisma.fighterApplication.create({
      data: { userId: user.id, status: "DRAFT", ...data },
    });
  } else {
    draft = await prisma.fighterApplication.update({
      where: { id: draft.id },
      data,
    });
  }

  return { ok: true as const, application: toApplicationJson(draft) };
}

export async function submitApplication(auth: AuthUser, body: ApplicationDraftBody) {
  const saved = await saveDraft(auth, { ...body, draftStep: 4 });
  if (!saved.ok) return saved;

  if (!saved.application.firstName?.trim() || !saved.application.lastName?.trim()) {
    return { ok: false as const, statusCode: 400 as const, error: "First and last name are required to submit." };
  }

  const user = await ensureUser(auth);
  const draft = await prisma.fighterApplication.findFirst({
    where: { userId: user.id, status: "DRAFT" },
  });
  if (!draft) {
    return { ok: false as const, statusCode: 400 as const, error: "Save a draft before submitting." };
  }

  const submitted = await prisma.fighterApplication.update({
    where: { id: draft.id },
    data: { status: "PENDING_REVIEW" },
  });

  return { ok: true as const, application: toApplicationJson(submitted) };
}
