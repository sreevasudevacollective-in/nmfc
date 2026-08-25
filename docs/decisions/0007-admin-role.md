# ADR 0007 — Admin role: a database column, not a JWT claim

**Status:** Accepted
**Date:** 2026-08-25
**Corrects:** [system-design.md §8](../system-design.md) described admin access as "same
system, elevated role claim" and `requireAdmin` as checking "the role claim" — read as a
Firebase custom claim on the JWT. That's not what was built, and not what this ADR chooses.

---

## Context

`UserRole.ADMIN` existed in the schema since ADR 0003, but nothing anywhere checked it —
every route was either fully public or gated only by "signed in." There was also no way for
anyone, including the site owner, to ever become an admin: no signup flow or route could
grant the role, and hand-editing a row in the database isn't a real bootstrap mechanism.

## Decision

**Role lives on the local `User.role` column in Postgres — not as a Firebase custom claim.**

```
requireAdmin(req):
  auth = verifyFirebaseIdToken(req)      // existing: verifies the JWT, unchanged
  user = ensureUser(auth)                // upserts/reads the local User row
  if user.role !== ADMIN: throw 403
  return auth
```

`ensureUser` (moved to `services/users.ts` so both the applicant and admin code paths share
it) also carries the bootstrap: an `ADMIN_EMAILS` environment variable, comma-separated.
Whoever signs in with a listed email is promoted to `ADMIN` on that sign-in — checked on
every `ensureUser` call, so adding an email to the list takes effect the next time that
person signs in, no redeploy of anything except the env var required. **It only promotes,
never demotes** — removing an email from the list does not strip an existing admin. That
would be a surprising way to silently lose access, and isn't the point of the list; the
point is solving "how does the very first admin get created."

`401` vs `403` are kept deliberately distinct, not collapsed into one "unauthorized":
`verifyFirebaseIdToken` failing (no token, expired, garbage) is `401` — the fix is to sign
in. A valid session belonging to a non-admin is `403` — the fix is a different account, or
being granted the role. A client needs to tell those two apart.

### Why a column, not a claim

A custom claim (set via the Firebase Admin SDK, read off the verified token) was the
mechanism implied by ADR 0002/0004's general shape and assumed in system-design.md §8. It
was not built that way, for two reasons:

- **Freshness.** A custom claim is baked into the ID token at mint time and only refreshes
  when the client forces a token refresh. A DB column is read fresh on every request — an
  admin promoted via `ADMIN_EMAILS` is immediately effective on their very next request,
  not after their session happens to rotate.
- **No new infrastructure.** `ensureUser` and the local `User` row already existed (ADR
  0003). Checking a column on a row we're already reading is simpler than adding the
  Firebase Admin SDK's custom-claims API as a second thing that grants privilege.

There is still no separate `AdminUser` table — admins are `User` rows with `role = ADMIN`,
consistent with ADR 0002's original "unified admin auth" position. Only *where the role is
stored and read from* differs from what was assumed.

## Consequences

### Positive
- Immediate effect on promotion — no token-refresh lag
- One mechanism (`ensureUser`) for both regular and admin user resolution
- A real, if minimal, bootstrap path exists — `ADMIN_EMAILS` — where none did before

### Negative / to manage
- Every admin-guarded request costs one extra `User` lookup/upsert beyond JWT verification.
  Irrelevant at NMFC's scale (a handful of admin actions, not a hot path); would matter if
  admin routes ever needed to scale independently.
- `ADMIN_EMAILS` is an environment variable, so granting or auditing admin access means
  touching deploy config, not a database record with its own audit trail. Acceptable for a
  small, static admin team; revisit if the admin roster grows or turns over often.

## Revisit if

- Admin access needs its own audit trail (who was granted admin, when, by whom) beyond what
  redeploying `ADMIN_EMAILS` implies.
- The admin-guarded surface grows enough that a per-request DB lookup is worth caching.
