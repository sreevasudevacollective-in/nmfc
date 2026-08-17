import type { Prisma } from "@prisma/client";
import type { Bout, EventDetail, EventListQuery, EventSummary, Paginated } from "@nmfc/shared";

import { prisma } from "../db/client.js";
import { NotFoundError } from "../lib/errors.js";
import { summarise } from "./fighters.js";

export async function listEvents(query: EventListQuery): Promise<Paginated<EventSummary>> {
  const where: Prisma.EventWhereInput = query.status ? { status: query.status } : {};

  const [events, total] = await Promise.all([
    prisma.event.findMany({
      where,
      orderBy: { date: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      // Bout counts come back with the page rather than as a query per event.
      include: { _count: { select: { fights: true } } },
    }),
    prisma.event.count({ where }),
  ]);

  return {
    data: events.map((event) => ({
      id: event.id,
      slug: event.slug,
      name: event.name,
      date: event.date.toISOString(),
      venue: event.venue,
      status: event.status,
      posterKey: event.posterKey,
      fightCount: event._count.fights,
    })),
    page: query.page,
    limit: query.limit,
    total,
  };
}

export async function getEventBySlug(slug: string): Promise<EventDetail> {
  const event = await prisma.event.findUnique({
    where: { slug },
    include: {
      fights: {
        // Main event first: the highest boutOrder leads the card (§3.2).
        orderBy: { boutOrder: "desc" },
        include: { fighterA: true, fighterB: true },
      },
    },
  });

  if (!event) throw new NotFoundError("Event", slug);

  // One batched summarise for every fighter on the card, rather than one per bout.
  const summaries = await summarise(
    event.fights.flatMap((fight) => [fight.fighterA, fight.fighterB]),
  );

  const bouts: Bout[] = event.fights.map((fight) => ({
    id: fight.id,
    boutOrder: fight.boutOrder,
    isTitleFight: fight.isTitleFight,
    weightClass: fight.weightClass,
    status: fight.status,
    outcome: fight.outcome,
    method: fight.method,
    round: fight.round,
    time: fight.time,
    fighterA: summaries.get(fight.fighterAId)!,
    fighterB: summaries.get(fight.fighterBId)!,
  }));

  return {
    id: event.id,
    slug: event.slug,
    name: event.name,
    date: event.date.toISOString(),
    venue: event.venue,
    status: event.status,
    posterKey: event.posterKey,
    fightCount: event.fights.length,
    bouts,
  };
}
