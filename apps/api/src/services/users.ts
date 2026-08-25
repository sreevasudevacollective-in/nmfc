import type { AuthUser } from "../auth/firebase.js";
import { prisma } from "../db/prisma.js";

/// Bootstrap mechanism for the very first admin(s): no UI or route grants ADMIN,
/// since that would be a privilege-escalation hole. Instead, whoever signs in with
/// an email on this list is (re)promoted to ADMIN on sign-in. Never demotes — removing
/// an email here does not strip an existing admin; that's a deliberate separate action.
const adminEmails = new Set(
  (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
);

export async function ensureUser(auth: AuthUser) {
  const email = auth.email.toLowerCase();
  const user = await prisma.user.upsert({
    where: { authUid: auth.uid },
    create: { authUid: auth.uid, role: adminEmails.has(email) ? "ADMIN" : "USER" },
    update: {},
  });

  if (user.role !== "ADMIN" && adminEmails.has(email)) {
    return prisma.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
  }

  return user;
}
