# ADR 0002 — Authentication

**Status:** Accepted — **provider amended by [ADR 0005](0005-gcp-platform.md)**
**Date:** 2026-08-17
**Supersedes:** the auth position in [ADR 0001](0001-cloud-platform.md) and system-design §8

> **The provider is Firebase Auth, not Supabase Auth** (ADR 0005). Everything else in this
> ADR stands: identity lives with the provider, a thin local `User` row is keyed by the
> provider's UID, no RLS, Fastify verifies the JWT and reads a role claim, admins are users
> with an elevated claim rather than a separate table.
>
> That the architecture survived a provider swap untouched is the point of having written it
> this way. Read "Coexistence with Prisma" below substituting Firebase for Supabase.

---

## Context

Public user accounts are now in scope, which reverses a v1 scope decision. Sign-up methods:

- **Email** — required
- **Google** — required
- **Phone / SMS OTP** — explicitly deferred, not in v1

ADR 0001 chose self-rolled admin-only JWT on the reasoning that "a handful of internal
admins doesn't justify the dependency." That reasoning no longer holds once public signup
with federated identity is in scope.

## Decision

**Use Supabase Auth** for both public users and admins.

| Concern | Choice |
|---|---|
| Identity provider | Supabase Auth |
| Methods (v1) | Email/password, Google OAuth |
| Transactional email | Custom SMTP — Resend (or SES/Postmark) |
| Admin access | Same system, distinguished by a role claim |
| API verification | Fastify verifies the Supabase-issued JWT |
| Data access | Prisma, unchanged. No RLS. |

## Rationale

We are already on Supabase for Postgres and object storage, and Supabase Auth covers both
required methods natively with 50k MAU on the free tier.

Self-rolling would mean owning password hashing, reset and verification flows, email
delivery, the OAuth handshake, and token rotation — along with the permanent security
surface of all of it. That is a poor trade for a small team when it is included with a
vendor already in the stack.

### Coexistence with Prisma

The concern raised in ADR 0001 — that Supabase Auth wants their client libraries and RLS,
which sits awkwardly with Prisma — does not apply here:

- Supabase Auth issues a JWT; Fastify verifies it and reads claims.
- Prisma continues to own all application data.
- **RLS is unnecessary** because the API is the only database client. RLS earns its keep
  when untrusted clients query Postgres directly, which is not this architecture.

Identity itself lives in Supabase's `auth` schema, which Prisma does not manage. We keep a
`User` profile row in our own schema keyed by the Supabase UID — the standard pattern.

### Unified admin auth

Running a separate self-rolled admin system alongside Supabase Auth would mean two token
formats, two login flows and two sets of security assumptions. Instead, admins are users
with an elevated role claim; the `requireAdmin` hook checks the claim rather than a
separate table. `AdminUser` from §8 is dropped.

## Consequences

### Positive
- Both sign-up methods work out of the box; no OAuth or reset flows to build
- One auth system for public and admin
- Free at anticipated scale
- Prisma and the existing Fastify structure are unaffected

### Negative / to manage

- **Custom SMTP is required before launch.** Supabase's built-in email service sends
  **2 messages per hour**, only to pre-authorized addresses, with no delivery SLA — it is
  for testing templates, not production. Configure Resend (or SES/Postmark). Note that even
  after configuring custom SMTP, Supabase applies a default 30/hour rate limit that must be
  raised deliberately.
- **Account linking needs an explicit decision.** If a user signs up with Google and later
  with email/password at the same address — one account or two? Supabase supports identity
  linking; the behavior should be chosen, not defaulted into.
- Identity data lives outside Prisma's schema, so user records span two systems. Keep the
  local `User` profile thin — the Supabase UID plus app-specific fields only.
- Adds a dependency on Supabase for a second critical subsystem, increasing the cost of
  ever leaving.

## Deferred: phone / SMS OTP

Dropped from v1, but documented so the cost is understood if it returns:

- Supabase **does not send SMS itself** — you supply a provider (Twilio, MessageBird,
  Vonage, TextLocal), or wire a custom one through the SMS hook.
- Sending OTP SMS to Indian numbers requires **TRAI DLT registration** — registering the
  business, sender IDs and message templates with the telecom DLT platform. This is
  paperwork with lead time, not a configuration flag, and is a launch-blocking dependency
  if discovered late.
- **MSG91** is the pragmatic provider for India: native, cheaper for domestic traffic, DLT
  compliance built in.
- Phone is the only method with meaningful per-use cost, so OTP endpoints need aggressive
  rate limiting — OTP spam is a common abuse vector that bills directly to you.

## Open question

**What do accounts unlock?** v1 currently has no logged-in features — no predictions,
comments, following, or notifications. The identity layer is the same regardless, so this
does not block the decision above, but it determines the shape of the `User` profile model
and should be settled before building on top of it.

## Revisit if

- Phone login returns to scope (see deferred section — budget for DLT lead time)
- Untrusted clients need direct database access (RLS becomes relevant)
- MAU exceeds the Supabase tier in use
