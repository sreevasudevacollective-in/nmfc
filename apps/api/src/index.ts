import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

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
