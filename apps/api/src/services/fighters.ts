import type { Fighter, Prisma } from "@prisma/client";
import type {
  FighterDetail,
  FighterFight,
  FighterListQuery,
  FighterSummary,
  Paginated,
} from "@nmfc/shared";

import { prisma } from "../db/client.js";
import { NotFoundError } from "../lib/errors.js";
import { nmfcRecord, totalRecord, type FightRecord } from "./record.js";

/**
 * Records are derived from Fight rows (§3.3), so every fighter shown needs their bouts.
 * Fetching those per fighter is the N+1 that melts an event page under load (§11), so
 * all of these helpers take a set of fighters and issue exactly one fights query.
 */
async function nmfcRecordMap(fighterIds: string[]): Promise<Map<string, FightRecord>> {
  const map = new Map<string, FightRecord>();
  if (fighterIds.length === 0) return map;

  const fights = await prisma.fight.findMany({
    where: {
      status: "COMPLETED",
      OR: [{ fighterAId: { in: fighterIds } }, { fighterBId: { in: fighterIds } }],
    },
    select: { fighterAId: true, fighterBId: true, status: true, outcome: true },
  });

  const byFighter = new Map<string, typeof fights>();
  for (const id of fighterIds) byFighter.set(id, []);
  for (const fight of fights) {
    byFighter.get(fight.fighterAId)?.push(fight);
    byFighter.get(fight.fighterBId)?.push(fight);
  }

  for (const id of fighterIds) {
    map.set(id, nmfcRecord(id, byFighter.get(id) ?? []));
  }

  return map;
}

function toSummary(fighter: Fighter, record: FightRecord): FighterSummary {
  return {
    id: fighter.id,
    slug: fighter.slug,
    firstName: fighter.firstName,
    lastName: fighter.lastName,
    nickname: fighter.nickname,
    weightClass: fighter.weightClass,
    photoKey: fighter.photoKey,
    record,
  };
}

/**
 * Summaries for already-loaded fighter rows, in one extra query regardless of count.
 * Shared by the event and ranking services, which embed fighters in their responses.
 */
export async function summarise(fighters: Fighter[]): Promise<Map<string, FighterSummary>> {
  const records = await nmfcRecordMap(fighters.map((f) => f.id));

  return new Map(
    fighters.map((fighter) => [
      fighter.id,
      toSummary(fighter, totalRecord(fighter, records.get(fighter.id) ?? nmfcRecord(fighter.id, []))),
    ]),
  );
}

export async function listFighters(query: FighterListQuery): Promise<Paginated<FighterSummary>> {
  const where: Prisma.FighterWhereInput = {
    ...(query.weightClass ? { weightClass: query.weightClass } : {}),
    ...(query.q
      ? {
          OR: [
            { firstName: { contains: query.q, mode: "insensitive" } },
            { lastName: { contains: query.q, mode: "insensitive" } },
            { nickname: { contains: query.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [fighters, total] = await Promise.all([
    prisma.fighter.findMany({
      where,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.fighter.count({ where }),
  ]);

  const summaries = await summarise(fighters);

  return {
    data: fighters.map((f) => summaries.get(f.id)!),
    page: query.page,
    limit: query.limit,
    total,
  };
}

export async function getFighterBySlug(slug: string): Promise<FighterDetail> {
  const fighter = await prisma.fighter.findUnique({
    where: { slug },
    include: {
      fightsAsA: { include: { event: true, fighterB: true } },
      fightsAsB: { include: { event: true, fighterA: true } },
    },
  });

  if (!fighter) throw new NotFoundError("Fighter", slug);

  // Normalise both sides into one list carrying an `opponent`, so the rest of this
  // function doesn't have to care which corner the fighter was in.
  const bouts = [
    ...fighter.fightsAsA.map((bout) => ({ ...bout, opponent: bout.fighterB })),
    ...fighter.fightsAsB.map((bout) => ({ ...bout, opponent: bout.fighterA })),
  ];

  // Opponents are summarised as a batch — one query for all of them, not one each.
  const opponentSummaries = await summarise(bouts.map((bout) => bout.opponent));

  const nmfc = nmfcRecord(fighter.id, bouts);

  const fights: FighterFight[] = bouts
    .map((bout) => {
      const isA = bout.fighterAId === fighter.id;

      return {
        id: bout.id,
        status: bout.status,
        result: resultFor(isA, bout.status, bout.outcome),
        opponent: opponentSummaries.get(bout.opponent.id)!,
        weightClass: bout.weightClass,
        isTitleFight: bout.isTitleFight,
        method: bout.method,
        round: bout.round,
        time: bout.time,
        event: {
          id: bout.event.id,
          slug: bout.event.slug,
          name: bout.event.name,
          date: bout.event.date.toISOString(),
        },
      };
    })
    // Most recent bout first — a fight history reads newest-down.
    .sort((a, b) => b.event.date.localeCompare(a.event.date));

  return {
    ...toSummary(fighter, totalRecord(fighter, nmfc)),
    dob: fighter.dob?.toISOString() ?? null,
    heightCm: fighter.heightCm,
    reachCm: fighter.reachCm,
    gym: fighter.gym,
    hometown: fighter.hometown,
    bio: fighter.bio,
    instagramUrl: fighter.instagramUrl,
    facebookUrl: fighter.facebookUrl,
    xUrl: fighter.xUrl,
    nmfcRecord: nmfc,
    fights,
  };
}

/** Translates a neutral A/B outcome into this fighter's result. */
function resultFor(
  isA: boolean,
  status: "SCHEDULED" | "COMPLETED" | "CANCELLED",
  outcome: "WIN_A" | "WIN_B" | "DRAW" | "NO_CONTEST" | null,
): FighterFight["result"] {
  if (status !== "COMPLETED" || outcome === null) return null;

  switch (outcome) {
    case "WIN_A":
      return isA ? "WIN" : "LOSS";
    case "WIN_B":
      return isA ? "LOSS" : "WIN";
    case "DRAW":
      return "DRAW";
    case "NO_CONTEST":
      return "NO_CONTEST";
  }
}
