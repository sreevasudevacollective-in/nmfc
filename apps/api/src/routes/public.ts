/**
 * Public read endpoints (docs/system-design.md §4).
 *
 * Route handlers do HTTP only — parse, validate, delegate, serialize. Business logic
 * lives in the services; nothing here touches Prisma directly.
 *
 * Public lookups are by slug; ids are reserved for admin mutations.
 */

import type { FastifyInstance } from "fastify";
import {
  eventListQuerySchema,
  fighterListQuerySchema,
  weightClassSchema,
} from "@nmfc/shared";

import { ApiError } from "../lib/errors.js";
import { getFighterBySlug, listFighters } from "../services/fighters.js";
import { getEventBySlug, listEvents } from "../services/events.js";
import { listRankings } from "../services/rankings.js";

export async function publicRoutes(app: FastifyInstance): Promise<void> {
  app.get("/fighters", async (request) => {
    const query = fighterListQuerySchema.parse(request.query);
    return listFighters(query);
  });

  app.get("/fighters/:slug", async (request) => {
    const { slug } = request.params as { slug: string };
    return getFighterBySlug(slug);
  });

  app.get("/events", async (request) => {
    const query = eventListQuerySchema.parse(request.query);
    return listEvents(query);
  });

  app.get("/events/:slug", async (request) => {
    const { slug } = request.params as { slug: string };
    return getEventBySlug(slug);
  });

  app.get("/rankings", async () => {
    return { divisions: await listRankings() };
  });

  app.get("/rankings/:weightClass", async (request) => {
    const { weightClass } = request.params as { weightClass: string };

    const parsed = weightClassSchema.safeParse(weightClass.toUpperCase());
    if (!parsed.success) {
      throw new ApiError(400, "INVALID_WEIGHT_CLASS", `Unknown weight class '${weightClass}'`, {
        allowed: weightClassSchema.options,
      });
    }

    const [division] = await listRankings(parsed.data);
    return division;
  });
}
