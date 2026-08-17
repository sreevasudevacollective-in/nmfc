import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
const app = Fastify({ logger: true });

// Allowlist from env. `origin: true` (reflect any origin) is fine locally but must
// never reach production — see docs/system-design.md §12.
const allowedOrigins = process.env.CORS_ORIGINS?.split(",").map((o) => o.trim()).filter(Boolean);

if (process.env.NODE_ENV === "production" && !allowedOrigins?.length) {
  throw new Error("CORS_ORIGINS must be set in production");
}

await app.register(cors, {
  origin: allowedOrigins?.length ? allowedOrigins : true,
});

app.get("/health", async () => ({ status: "ok" }));

app.get("/fighters", async () => {
  return prisma.fighter.findMany({ orderBy: { lastName: "asc" } });
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

const port = Number(process.env.PORT) || 4000;
app.listen({ port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
