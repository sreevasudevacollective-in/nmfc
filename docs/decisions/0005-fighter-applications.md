# ADR 0005 — Open fighter applications, admin accept

**Status:** Accepted
**Date:** 2026-08-17
**Supersedes:** closed roster / claim-link in [ADR 0003](0003-fighter-accounts.md) §1
**Keeps:** field ownership, private `FighterProfile`, audit log (ADR 0003 §2–4)

---

## Context

Enrollment is not invite-only. Anyone may create an account and apply to be listed as a
fighter. The promotion **reviews, verifies, and accepts or rejects** from the admin
dashboard. Applicants must not appear on public Fighters pages until an admin accepts.

## Decision

```
Anyone signs up (Identity Platform — email or Google)
  → User row (role USER)
  → submits a fighter application (PENDING_REVIEW)
  → admin reviews and verifies in the dashboard
  → ACCEPT  → public Fighter created, User bound, application ACCEPTED
  → REJECT  → application REJECTED, no public profile
```

| Rule | Detail |
|---|---|
| Signup | Open. No claim token. |
| Public roster | **`Fighter` rows only.** Applications are never listed on `GET /fighters`. |
| Accept | Admin-only. Creates the public record and binds `User` ↔ `Fighter`. |
| Reject | Admin-only. Stays off the site. Applicant can be allowed to re-apply later. |
| Record / rankings | Still **not** applicant- or fighter-writable (ADR 0003). |
| After accept | Fighter-owned fields as in ADR 0003; edits audited. |

Leagues (IFL, IPBL, NMFC) stay out of this slice.

## Model

```
User                 // Identity Platform UID; role: ADMIN | USER
  ├─ applications[]
  └─ Fighter?        // set only after accept

FighterApplication   // intake; not public
  ├─ status          PENDING_REVIEW | REJECTED | ACCEPTED | WITHDRAWN
  ├─ submitted fields (name, gym, hometown, …)
  ├─ private contact (or a private application profile)
  ├─ reviewerUserId, reviewedAt, reviewNotes
  └─ fighterId?      // set on accept

Fighter              // public roster only
  ├─ userId
  └─ FighterProfile  // private PII after accept
```

## Consequences

- Fake or incomplete people can sign up; they **do not** go live until accept.
- Admins must staff a queue. An unworked queue means applicants wait, not that junk is public.
- Identity Platform is required before the apply form can be real (JWT on submit).
- Verify (ID, gym, record) is an **admin process**; storing ID scans is still an open DPDP question.

## Revisit if

- Applications should create a hidden `Fighter` row instead of a separate table.
- Fighters may apply per league when leagues ship.
