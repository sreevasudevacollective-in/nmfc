import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";

import { prisma } from "./db/client.js";
import { registerErrorHandler } from "./lib/errors.js";
import { publicRoutes } from "./routes/public.js";

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

registerErrorHandler(app);

app.get("/health", async () => ({ status: "ok" }));

// Versioned from day one — mobile clients in the wild can't be force-upgraded (§4).
await app.register(publicRoutes, { prefix: "/v1" });

const shutdown = async (signal: string) => {
  app.log.info({ signal }, "shutting down");
  await app.close();
  await prisma.$disconnect();
  process.exit(0);
};

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

const port = Number(process.env.PORT) || 4000;

app.listen({ port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
