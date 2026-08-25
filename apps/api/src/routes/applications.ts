import type { FastifyInstance } from "fastify";
import { verifyFirebaseIdToken } from "../auth/firebase.js";
import { applicationDraftBody } from "../schemas/application.js";
import { getMyApplication, saveDraft, submitApplication } from "../services/applications.js";

async function requireAuth(authorization: string | undefined) {
  return verifyFirebaseIdToken(authorization);
}

export async function registerApplicationRoutes(app: FastifyInstance) {
  app.get("/v1/applications/me", async (req, reply) => {
    try {
      const auth = await requireAuth(req.headers.authorization);
      const application = await getMyApplication(auth);
      return { application };
    } catch (err) {
      const statusCode = err && typeof err === "object" && "statusCode" in err ? Number(err.statusCode) : 500;
      return reply.code(statusCode).send({ error: err instanceof Error ? err.message : "Unauthorized" });
    }
  });

  app.put("/v1/applications/me", async (req, reply) => {
    try {
      const auth = await requireAuth(req.headers.authorization);
      const parsed = applicationDraftBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "Invalid draft", details: parsed.error.flatten() });
      }
      const result = await saveDraft(auth, parsed.data);
      if (!result.ok) return reply.code(result.statusCode).send({ error: result.error });
      return result.application;
    } catch (err) {
      const statusCode = err && typeof err === "object" && "statusCode" in err ? Number(err.statusCode) : 500;
      return reply.code(statusCode).send({ error: err instanceof Error ? err.message : "Unauthorized" });
    }
  });

  app.post("/v1/applications/me/submit", async (req, reply) => {
    try {
      const auth = await requireAuth(req.headers.authorization);
      const parsed = applicationDraftBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "Invalid application", details: parsed.error.flatten() });
      }
      const result = await submitApplication(auth, parsed.data);
      if (!result.ok) return reply.code(result.statusCode).send({ error: result.error });
      return result.application;
    } catch (err) {
      const statusCode = err && typeof err === "object" && "statusCode" in err ? Number(err.statusCode) : 500;
      return reply.code(statusCode).send({ error: err instanceof Error ? err.message : "Unauthorized" });
    }
  });
}
