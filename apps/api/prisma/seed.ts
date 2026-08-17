/**
 * Development seed data.
 *
 * Idempotent — everything upserts on its natural key (slug), so re-running updates in
 * place rather than duplicating. Safe to run repeatedly against a local database.
 *
 * Note there are no `wins`/`losses` columns to set: NMFC records are derived from the
 * bouts below (§3.3). `prior*` holds only what these fighters brought in from elsewhere.
 */

import "dotenv/config";
import { PrismaClient, type WeightClass } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

import { slugify } from "../src/lib/slug.js";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

interface FighterSeed {
  firstName: string;
  lastName: string;
  nickname?: string;
  weightClass: WeightClass;
  heightCm: number;
  reachCm: number;
  gym: string;
  hometown: string;
  /** Pre-NMFC record: [wins, losses, draws] */
  prior: [number, number, number];
  bio?: string;
}

const fighters: FighterSeed[] = [
  {
    firstName: "Arjun", lastName: "Rao", nickname: "The Bolt",
    weightClass: "LIGHTWEIGHT", heightCm: 178, reachCm: 183,
    gym: "Iron Peak MMA", hometown: "Hyderabad", prior: [7, 2, 0],
    bio: "Explosive southpaw striker who built his record on the regional circuit before joining NMFC.",
  },
  {
    firstName: "Vikram", lastName: "Singh", nickname: "Hammer",
    weightClass: "LIGHTWEIGHT", heightCm: 175, reachCm: 178,
    gym: "Punjab Combat Club", hometown: "Ludhiana", prior: [6, 3, 1],
    bio: "Wrestling-first grinder with a reputation for pushing a hard pace into deep water.",
  },
  {
    firstName: "Rohit", lastName: "Menon",
    weightClass: "LIGHTWEIGHT", heightCm: 180, reachCm: 185,
    gym: "Coastal Fight Lab", hometown: "Kochi", prior: [4, 1, 0],
  },
  {
    firstName: "Sameer", lastName: "Khan", nickname: "Silk",
    weightClass: "LIGHTWEIGHT", heightCm: 177, reachCm: 180,
    gym: "Deccan Martial Arts", hometown: "Aurangabad", prior: [5, 4, 0],
  },
  {
    firstName: "Karan", lastName: "Iyer", nickname: "Cobra",
    weightClass: "WELTERWEIGHT", heightCm: 183, reachCm: 190,
    gym: "Iron Peak MMA", hometown: "Chennai", prior: [9, 1, 0],
    bio: "Long reach and a jab that sets up everything else. Undefeated inside the NMFC cage.",
  },
  {
    firstName: "Aditya", lastName: "Nair",
    weightClass: "WELTERWEIGHT", heightCm: 181, reachCm: 186,
    gym: "Bengaluru BJJ", hometown: "Bengaluru", prior: [6, 2, 1],
  },
  {
    firstName: "Farhan", lastName: "Sheikh", nickname: "The Surgeon",
    weightClass: "WELTERWEIGHT", heightCm: 185, reachCm: 191,
    gym: "Mumbai Muay Thai", hometown: "Mumbai", prior: [8, 3, 0],
  },
  {
    firstName: "Nikhil", lastName: "Das", nickname: "Blade",
    weightClass: "FEATHERWEIGHT", heightCm: 170, reachCm: 175,
    gym: "Eastern Grapplers", hometown: "Kolkata", prior: [10, 2, 0],
    bio: "Submission specialist — most of his wins have come by way of the rear-naked choke.",
  },
  {
    firstName: "Imran", lastName: "Qureshi",
    weightClass: "FEATHERWEIGHT", heightCm: 168, reachCm: 172,
    gym: "Deccan Martial Arts", hometown: "Hyderabad", prior: [5, 5, 1],
  },
  {
    firstName: "Rajat", lastName: "Verma", nickname: "The Wall",
    weightClass: "MIDDLEWEIGHT", heightCm: 188, reachCm: 194,
    gym: "Northern Fight Academy", hometown: "Delhi", prior: [7, 4, 0],
  },
  {
    firstName: "Yusuf", lastName: "Ali",
    weightClass: "MIDDLEWEIGHT", heightCm: 186, reachCm: 189,
    gym: "Mumbai Muay Thai", hometown: "Pune", prior: [6, 6, 0],
  },
  {
    firstName: "Deepak", lastName: "Rathore", nickname: "Bulldozer",
    weightClass: "BANTAMWEIGHT", heightCm: 165, reachCm: 168,
    gym: "Punjab Combat Club", hometown: "Jaipur", prior: [4, 2, 2],
  },
];

type Outcome = "WIN_A" | "WIN_B" | "DRAW" | "NO_CONTEST";

interface BoutSeed {
  /** Fighter slugs. */
  a: string;
  b: string;
  weightClass: WeightClass;
  isTitleFight?: boolean;
  outcome?: Outcome;
  method?: string;
  round?: number;
  time?: string;
}

interface EventSeed {
  name: string;
  date: string;
  venue: string;
  status: "SCHEDULED" | "COMPLETED" | "CANCELLED";
  /** Listed main event first; boutOrder is assigned so the main event sorts highest. */
  bouts: BoutSeed[];
}

const events: EventSeed[] = [
  {
    name: "NMFC 1: Origins",
    date: "2026-03-14T18:00:00.000Z",
    venue: "Gachibowli Indoor Stadium, Hyderabad",
    status: "COMPLETED",
    bouts: [
      { a: "arjun-rao", b: "vikram-singh", weightClass: "LIGHTWEIGHT", isTitleFight: true,
        outcome: "WIN_A", method: "TKO (punches)", round: 2, time: "3:41" },
      { a: "karan-iyer", b: "aditya-nair", weightClass: "WELTERWEIGHT",
        outcome: "WIN_A", method: "Decision (unanimous)", round: 3, time: "5:00" },
      { a: "nikhil-das", b: "imran-qureshi", weightClass: "FEATHERWEIGHT",
        outcome: "WIN_A", method: "Submission (rear-naked choke)", round: 1, time: "4:12" },
      { a: "rajat-verma", b: "yusuf-ali", weightClass: "MIDDLEWEIGHT",
        outcome: "DRAW", method: "Decision (split)", round: 3, time: "5:00" },
    ],
  },
  {
    name: "NMFC 2: Reckoning",
    date: "2026-07-25T18:00:00.000Z",
    venue: "Jawaharlal Nehru Stadium, Chennai",
    status: "COMPLETED",
    bouts: [
      { a: "karan-iyer", b: "farhan-sheikh", weightClass: "WELTERWEIGHT", isTitleFight: true,
        outcome: "WIN_A", method: "Decision (unanimous)", round: 5, time: "5:00" },
      { a: "rohit-menon", b: "sameer-khan", weightClass: "LIGHTWEIGHT",
        outcome: "WIN_B", method: "KO (head kick)", round: 1, time: "2:07" },
      { a: "vikram-singh", b: "sameer-khan", weightClass: "LIGHTWEIGHT",
        outcome: "NO_CONTEST", method: "No contest (accidental foul)", round: 2, time: "1:15" },
      { a: "deepak-rathore", b: "imran-qureshi", weightClass: "BANTAMWEIGHT",
        outcome: "WIN_A", method: "Submission (guillotine)", round: 2, time: "3:30" },
    ],
  },
  {
    name: "NMFC 3: Ascension",
    date: "2026-11-21T18:00:00.000Z",
    venue: "Sree Kanteerava Stadium, Bengaluru",
    status: "SCHEDULED",
    bouts: [
      { a: "arjun-rao", b: "rohit-menon", weightClass: "LIGHTWEIGHT", isTitleFight: true },
      { a: "farhan-sheikh", b: "aditya-nair", weightClass: "WELTERWEIGHT" },
      { a: "nikhil-das", b: "deepak-rathore", weightClass: "FEATHERWEIGHT" },
      { a: "yusuf-ali", b: "rajat-verma", weightClass: "MIDDLEWEIGHT" },
    ],
  },
];

/** Manually curated, as decided in §6. Order is the ranking. */
const rankings: Array<[WeightClass, string[]]> = [
  ["LIGHTWEIGHT", ["arjun-rao", "rohit-menon", "vikram-singh", "sameer-khan"]],
  ["WELTERWEIGHT", ["karan-iyer", "farhan-sheikh", "aditya-nair"]],
  ["FEATHERWEIGHT", ["nikhil-das", "imran-qureshi"]],
  ["MIDDLEWEIGHT", ["rajat-verma", "yusuf-ali"]],
];

async function main() {
  // --- Fighters -----------------------------------------------------------
  for (const f of fighters) {
    const slug = slugify(`${f.firstName} ${f.lastName}`, "fighter");
    const data = {
      firstName: f.firstName,
      lastName: f.lastName,
      nickname: f.nickname ?? null,
      weightClass: f.weightClass,
      heightCm: f.heightCm,
      reachCm: f.reachCm,
      gym: f.gym,
      hometown: f.hometown,
      bio: f.bio ?? null,
      priorWins: f.prior[0],
      priorLosses: f.prior[1],
      priorDraws: f.prior[2],
    };

    await prisma.fighter.upsert({ where: { slug }, create: { slug, ...data }, update: data });
  }

  const fighterIdBySlug = new Map(
    (await prisma.fighter.findMany({ select: { id: true, slug: true } })).map((f) => [f.slug, f.id]),
  );

  // --- Events and cards ---------------------------------------------------
  for (const e of events) {
    const slug = slugify(e.name, "event");
    const data = { name: e.name, date: new Date(e.date), venue: e.venue, status: e.status };

    const event = await prisma.event.upsert({
      where: { slug },
      create: { slug, ...data },
      update: data,
    });

    // Bouts have no natural key, so the card is rebuilt wholesale on each run.
    await prisma.fight.deleteMany({ where: { eventId: event.id } });

    await prisma.fight.createMany({
      data: e.bouts.map((bout, index) => {
        const fighterAId = fighterIdBySlug.get(bout.a);
        const fighterBId = fighterIdBySlug.get(bout.b);
        if (!fighterAId || !fighterBId) {
          throw new Error(`Unknown fighter in bout: ${bout.a} vs ${bout.b}`);
        }

        return {
          eventId: event.id,
          fighterAId,
          fighterBId,
          weightClass: bout.weightClass,
          // Listed main-event-first, stored highest-first, so the card sorts correctly.
          boutOrder: e.bouts.length - index,
          isTitleFight: bout.isTitleFight ?? false,
          status: bout.outcome ? ("COMPLETED" as const) : ("SCHEDULED" as const),
          outcome: bout.outcome ?? null,
          method: bout.method ?? null,
          round: bout.round ?? null,
          time: bout.time ?? null,
        };
      }),
    });
  }

  // --- Rankings -----------------------------------------------------------
  await prisma.ranking.deleteMany({});

  for (const [weightClass, slugs] of rankings) {
    await prisma.ranking.createMany({
      data: slugs.map((slug, index) => {
        const fighterId = fighterIdBySlug.get(slug);
        if (!fighterId) throw new Error(`Unknown fighter in rankings: ${slug}`);
        return { fighterId, weightClass, rank: index + 1 };
      }),
    });
  }

  const counts = {
    fighters: await prisma.fighter.count(),
    events: await prisma.event.count(),
    fights: await prisma.fight.count(),
    rankings: await prisma.ranking.count(),
  };
  console.log("seeded", counts);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
