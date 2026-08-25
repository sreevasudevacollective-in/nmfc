import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { prisma } from "./db/prisma.js";
import { registerApplicationRoutes } from "./routes/applications.js";
import { registerAdminRoutes } from "./routes/admin.js";
import { sponsorInquiryBody } from "./schemas/sponsor-inquiry.js";

const app = Fastify({ logger: true });

const allowedOrigins = process.env.CORS_ORIGINS?.split(",").map((o) => o.trim()).filter(Boolean);

if (process.env.NODE_ENV === "production" && !allowedOrigins?.length) {
  throw new Error("CORS_ORIGINS must be set in production");
}

await app.register(cors, {
  origin: allowedOrigins?.length ? allowedOrigins : true,
  methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Authorization", "Content-Type"],
});

const publicFighterSelect = {
  id: true,
  slug: true,
  firstName: true,
  lastName: true,
  nickname: true,
  dob: true,
  weightClass: true,
  heightCm: true,
  reachCm: true,
  priorWins: true,
  priorLosses: true,
  priorDraws: true,
  wins: true,
  losses: true,
  draws: true,
  bio: true,
  gym: true,
  hometown: true,
  instagram: true,
  photoKey: true,
  photoUrl: true,
} as const;

app.get("/health", async () => ({ status: "ok" }));

const publicLeagueSelect = {
  id: true,
  slug: true,
  name: true,
  kind: true,
  discipline: true,
  description: true,
  logoKey: true,
  websiteUrl: true,
} as const;

// Versioned like the applicant/admin routes below — mobile clients in the wild can't be
// force-upgraded. These used to be unversioned; moved under /v1 to fix that inconsistency.
// /health stays bare: it's an infra probe, not a data contract.

app.get("/v1/fighters", async (req) => {
  const { league } = req.query as { league?: string };
  return prisma.fighter.findMany({
    where: league ? { leagues: { some: { league: { slug: league } } } } : undefined,
    orderBy: { lastName: "asc" },
    select: {
      ...publicFighterSelect,
      leagues: { select: { league: { select: { slug: true, name: true } } } },
    },
  });
});

app.get("/v1/leagues", async (req) => {
  const { kind } = req.query as { kind?: string };
  return prisma.league.findMany({
    where: kind ? { kind: kind as never } : undefined,
    orderBy: [{ kind: "asc" }, { displayOrder: "asc" }],
    select: publicLeagueSelect,
  });
});

app.get("/v1/events", async (req) => {
  const { league } = req.query as { league?: string };
  return prisma.event.findMany({
    where: league ? { league: { slug: league } } : undefined,
    orderBy: { date: "desc" },
    include: { fights: true, league: { select: publicLeagueSelect } },
  });
});

app.get("/v1/rankings/:weightClass", async (req) => {
  const { weightClass } = req.params as { weightClass: string };
  const { league } = req.query as { league?: string };
  return prisma.ranking.findMany({
    where: {
      weightClass: weightClass as never,
      league: league ? { slug: league } : undefined,
    },
    orderBy: [{ leagueId: "asc" }, { rank: "asc" }],
    include: { fighter: true, league: { select: publicLeagueSelect } },
  });
});

app.get("/v1/products", async () => {
  return prisma.product.findMany({
    where: { isAvailable: true },
    orderBy: [{ category: "asc" }, { displayOrder: "asc" }],
  });
});

app.post("/v1/sponsor-inquiries", async (req, reply) => {
  const parsed = sponsorInquiryBody.safeParse(req.body);
  if (!parsed.success) {
    return reply.code(400).send({ error: "Invalid inquiry", details: parsed.error.flatten() });
  }
  const inquiry = await prisma.sponsorInquiry.create({ data: parsed.data });
  return reply.code(201).send({ id: inquiry.id });
});

await registerApplicationRoutes(app);
await registerAdminRoutes(app);

const port = Number(process.env.PORT) || 4000;
app.listen({ port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
