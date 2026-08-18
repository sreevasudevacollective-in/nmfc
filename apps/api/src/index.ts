import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { prisma } from "./db/prisma.js";
import { registerApplicationRoutes } from "./routes/applications.js";

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

app.get("/fighters", async () => {
  return prisma.fighter.findMany({
    orderBy: { lastName: "asc" },
    select: publicFighterSelect,
  });
});

app.get("/events", async () => {
  return prisma.event.findMany({ orderBy: { date: "desc" }, include: { fights: true } });
});

app.get("/rankings/:weightClass", async (req) => {
  const { weightClass } = req.params as { weightClass: string };
  return prisma.ranking.findMany({
    where: { weightClass: weightClass as never },
    orderBy: { rank: "asc" },
    include: { fighter: true },
  });
});

await registerApplicationRoutes(app);

const port = Number(process.env.PORT) || 4000;
app.listen({ port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
