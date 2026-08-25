import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { requireAdmin } from "../auth/guard.js";
import { acceptApplication, listApplications, rejectApplication } from "../services/admin-applications.js";

const rejectBody = z.object({
  reviewNotes: z.string().trim().max(2000).optional(),
});

function sendAuthError(err: unknown, reply: FastifyReply) {
  const statusCode = err && typeof err === "object" && "statusCode" in err ? Number(err.statusCode) : 500;
  return reply.code(statusCode).send({ error: err instanceof Error ? err.message : "Unauthorized" });
}

export async function registerAdminRoutes(app: FastifyInstance) {
  app.get("/v1/admin/applications", async (req, reply) => {
    try {
      await requireAdmin(req);
      const { status } = req.query as { status?: string };
      return { applications: await listApplications(status) };
    } catch (err) {
      return sendAuthError(err, reply);
    }
  });

  app.post("/v1/admin/applications/:id/accept", async (req, reply) => {
    try {
      const auth = await requireAdmin(req);
      const { id } = req.params as { id: string };
      const result = await acceptApplication(auth, id);
      if (!result.ok) return reply.code(result.statusCode).send({ error: result.error });
      return result;
    } catch (err) {
      return sendAuthError(err, reply);
    }
  });

  app.post("/v1/admin/applications/:id/reject", async (req, reply) => {
    try {
      const auth = await requireAdmin(req);
      const { id } = req.params as { id: string };
      const parsed = rejectBody.safeParse(req.body ?? {});
      if (!parsed.success) {
        return reply.code(400).send({ error: "Invalid body", details: parsed.error.flatten() });
      }
      const result = await rejectApplication(auth, id, parsed.data.reviewNotes);
      if (!result.ok) return reply.code(result.statusCode).send({ error: result.error });
      return result;
    } catch (err) {
      return sendAuthError(err, reply);
    }
  });
}
