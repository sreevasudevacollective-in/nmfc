import type { FastifyRequest } from "fastify";
import { verifyFirebaseIdToken, type AuthUser } from "./firebase.js";
import { ensureUser } from "../services/users.js";

/// Verifies the caller's Firebase session AND that their local User row is ADMIN.
/// Distinguishes "not signed in" (401) from "signed in but not an admin" (403) —
/// the two calling conventions look identical to a client but mean different things:
/// the first is "sign in", the second is "this account can't do that".
export async function requireAdmin(req: FastifyRequest): Promise<AuthUser> {
  const auth = await verifyFirebaseIdToken(req.headers.authorization);
  const user = await ensureUser(auth);

  if (user.role !== "ADMIN") {
    throw Object.assign(new Error("Admin access required."), { statusCode: 403 });
  }

  return auth;
}
