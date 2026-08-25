import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

function slugify(firstName: string, lastName: string) {
  return `${firstName}-${lastName}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

const nmfc = await prisma.league.upsert({
  where: { slug: "no-mercy-fighting-championship" },
  update: {},
  create: {
    id: "league_nmfc",
    slug: "no-mercy-fighting-championship",
    name: "No Mercy Fighting Championship",
    kind: "HOME",
    discipline: "MMA",
    displayOrder: 0,
  },
});

await prisma.league.upsert({
  where: { slug: "no-mercy-hand-to-hand" },
  update: {},
  create: {
    id: "league_hand_to_hand",
    slug: "no-mercy-hand-to-hand",
    name: "No Mercy Hand to Hand",
    kind: "HOME",
    discipline: "Hand to Hand",
    displayOrder: 1,
  },
});

await prisma.league.upsert({
  where: { slug: "no-mercy-slap-wars" },
  update: {},
  create: {
    id: "league_slap_wars",
    slug: "no-mercy-slap-wars",
    name: "No Mercy Slap Wars",
    kind: "HOME",
    discipline: "Slap Fighting",
    displayOrder: 2,
  },
});

await prisma.league.upsert({
  where: { slug: "pro-mma-india" },
  update: {},
  create: {
    slug: "pro-mma-india",
    name: "Pro MMA India",
    kind: "PARTNERED",
    discipline: "MMA",
    description: "A partnered promotion. Directory listing only — no roster or events tracked here.",
    websiteUrl: "https://example.com",
    displayOrder: 0,
  },
});

const a = await prisma.fighter.create({
  data: {
    slug: slugify("Arjun", "Rao"),
    firstName: "Arjun",
    lastName: "Rao",
    nickname: "The Bolt",
    weightClass: "LIGHTWEIGHT",
    priorWins: 8,
    priorLosses: 2,
    wins: 8,
    losses: 2,
    gym: "Hyderabad Fight Club",
    hometown: "Hyderabad",
  },
});

const b = await prisma.fighter.create({
  data: {
    slug: slugify("Vikram", "Singh"),
    firstName: "Vikram",
    lastName: "Singh",
    nickname: "Hammer",
    weightClass: "LIGHTWEIGHT",
    priorWins: 6,
    priorLosses: 3,
    wins: 6,
    losses: 3,
    gym: "Delhi MMA",
    hometown: "Delhi",
  },
});

await prisma.fighterLeague.createMany({
  data: [
    { fighterId: a.id, leagueId: nmfc.id },
    { fighterId: b.id, leagueId: nmfc.id },
  ],
  skipDuplicates: true,
});

const event = await prisma.event.create({
  data: {
    leagueId: nmfc.id,
    name: "NMFC 1: Origins",
    date: new Date("2026-10-10"),
    venue: "Hyderabad Arena",
  },
});

await prisma.fight.create({
  data: {
    eventId: event.id,
    fighterAId: a.id,
    fighterBId: b.id,
    weightClass: "LIGHTWEIGHT",
    winnerId: a.id,
    method: "TKO",
    round: 2,
    time: "3:41",
  },
});

await prisma.ranking.createMany({
  data: [
    { leagueId: nmfc.id, fighterId: a.id, weightClass: "LIGHTWEIGHT", rank: 1 },
    { leagueId: nmfc.id, fighterId: b.id, weightClass: "LIGHTWEIGHT", rank: 2 },
  ],
});

await prisma.product.upsert({
  where: { slug: "nmfc-fight-week-tee" },
  update: {},
  create: {
    slug: "nmfc-fight-week-tee",
    name: "Fight Week Tee",
    description: "Official fight-week t-shirt.",
    priceInr: 899,
    category: "Apparel",
  },
});

console.log("seeded");
await prisma.$disconnect();
