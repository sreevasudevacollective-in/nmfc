import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

function slugify(firstName: string, lastName: string) {
  return `${firstName}-${lastName}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

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

const event = await prisma.event.create({
  data: { name: "NMFC 1: Origins", date: new Date("2026-10-10"), venue: "Hyderabad Arena" },
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
    { fighterId: a.id, weightClass: "LIGHTWEIGHT", rank: 1 },
    { fighterId: b.id, weightClass: "LIGHTWEIGHT", rank: 2 },
  ],
});

console.log("seeded");
await prisma.$disconnect();
