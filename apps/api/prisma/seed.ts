import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const a = await prisma.fighter.create({
  data: { firstName: "Arjun", lastName: "Rao", nickname: "The Bolt", weightClass: "LIGHTWEIGHT", wins: 8, losses: 2 },
});

const b = await prisma.fighter.create({
  data: { firstName: "Vikram", lastName: "Singh", nickname: "Hammer", weightClass: "LIGHTWEIGHT", wins: 6, losses: 3 },
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
