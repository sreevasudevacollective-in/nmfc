# ADR 0005 — Google Cloud for API, database, storage and auth

**Status:** Accepted
**Date:** 2026-08-17
**Supersedes:** [ADR 0001 — Cloud platform](0001-cloud-platform.md)
**Amends:** [ADR 0002 — Authentication](0002-authentication.md)

---

## Context

ADR 0001 chose Vercel + Fly.io + Supabase, all in or near Mumbai, and dismissed the
hyperscalers in two sentences: "ops burden unjustified at this scale; higher cost floor."
That was too thin for a structural decision, so the options were costed properly against
India-region pricing.

Two findings changed the picture.

**AWS is 2–3× every alternative for this workload**, and almost none of the premium buys
capability NMFC would use. It is fixed overhead that exists before a single request is
served: an Application Load Balancer at $18–22/month, a NAT gateway at ~$33/month for
Fargate tasks in private subnets, and a ~42% Mumbai regional premium landing on RDS, the
largest line item. That gap closes at scale — $50/month of fixed cost is a rounding error
on a large bill — but NMFC is a low-traffic content site for the foreseeable future.

**GCP is the one hyperscaler that competes on price here**, at roughly $25–30/month,
because Cloud Run needs neither a load balancer nor a NAT gateway to serve HTTPS. It maps
almost one-to-one onto what Fly.io was doing.

A correction to ADR 0001 also narrowed the gap: it quoted $25–30/month assuming Vercel's
free Hobby tier, but **Hobby prohibits commercial use**, and a ticketed promotion is
commercial. The honest figure for the superseded stack was ~$50/month on Vercel Pro.

## Decision

| Component | Service | Region |
|---|---|---|
| API | Cloud Run | `asia-south1` (Mumbai) |
| Database | Cloud SQL for PostgreSQL | `asia-south1` |
| Connection pooling | Cloud SQL Managed Connection Pooling | — |
| Object storage | Cloud Storage | `asia-south1` |
| Auth | Firebase Auth | — |
| Secrets | Secret Manager | — |
| Container images | Artifact Registry | `asia-south1` |
| Build & deploy | Cloud Build | — |
| **Web** | **Vercel (unchanged)** | Edge/global |
| Transactional email | External provider — still open | — |

### Web stays on Vercel

This is deliberate, and it means the platform is **two vendors, not one**.

ADR 0001 named edge caching as the dominant scaling lever for fight-night spikes, and that
lever is Next.js ISR. Self-hosting Next.js on Cloud Run means adopting OpenNext or SST, or
giving up ISR and image optimization. Neither is worth it to remove one vendor from the
bill, particularly when Vercel is the best host for the framework.

Moving web onto Cloud Run later remains possible. It is a considered trade-off, not a
loose end.

### Auth: Firebase Auth, amending ADR 0002

ADR 0002 chose Supabase Auth. Leaving Supabase for the database means leaving it for auth,
because the value of Supabase was the bundle.

**Firebase Auth** replaces it. It is part of the same Google Cloud project and bill, covers
both required methods (email/password and Google OAuth), and is effectively free at
NMFC's scale.

**ADR 0002's architecture survives unchanged**, which is the important part. It already
specified:

- identity lives with the provider, not in Prisma's schema
- a thin local `User` row keyed by the **provider's UID**
- no RLS, because the API is the only database client
- Fastify verifies the provider's JWT and reads a role claim

Every one of those holds against Firebase Auth. `User.id` is a plain `String` holding an
external UID — it does not care which provider issued it. What changes is the JWKS endpoint
and issuer/audience used in verification, the client SDK, and the mechanism for setting the
role claim (Firebase custom claims via the Admin SDK rather than Supabase `app_metadata`).

The switching cost is near zero **because no auth code exists yet** — no `supabase`
dependency anywhere, no JWT verification, nothing writing to `User`. This decision was made
at the cheapest possible moment; after fighters and applicants held live accounts it would
have meant migrating password hashes and remapping every UID.

Identity Platform is the same underlying service with an SLA and enterprise features
(multi-tenancy, SAML). Upgrading to it later requires no migration, so starting on Firebase
Auth costs nothing in optionality.

### Migrations run as a deploy step

ADR 0001 was explicit: migrations never run at app boot. Fly provided `release_command`;
Cloud Run has no equivalent hook, so the job is explicit instead — a **Cloud Run Job**
running `prisma migrate deploy`, executed by Cloud Build after the image is pushed and
before the new revision takes traffic.

### Storage needs no schema change

`Fighter.photoKey` and `Event.posterKey` already store storage **keys** rather than URLs,
specifically so the CDN domain could change without a data migration. That decision pays
for itself here: moving from Supabase Storage to Cloud Storage touches no data.

## Consequences

### Positive
- API and database co-located in Mumbai — the constraint that drove ADR 0001 is preserved
- One project, one bill, one IAM model for everything except web and email
- Private networking available: the database need not have a public endpoint
- Cleaner DPDP data-residency posture, which matters given the PII in ADR 0003/0004
- Cost roughly at or below the superseded stack once Vercel Pro is counted
- Dockerfile ships unchanged; the API reads `PORT`, which is what Cloud Run injects

### Negative / to manage

- **No native transactional email on GCP.** AWS has SES and Azure has Communication
  Services; GCP has no equivalent. An external sender (Resend, SendGrid, Mailgun) is still
  required. This is not a regression — the superseded stack needed one too.
- **Cloud CDN in front of Cloud Storage requires a load balancer** (~$18–25/month), which
  partly erodes the no-load-balancer advantage. Only needed for edge-cached images on a
  custom domain; serving from Cloud Storage directly, or letting Vercel optimize images,
  avoids it at this scale.
- **Cloud SQL shared-core tiers carry no SLA.** The first tier with one costs meaningfully
  more. Acceptable pre-launch; revisit before it matters.
- Three services replace one: Cloud SQL + Firebase Auth + Cloud Storage instead of Supabase.
  More IAM and more wiring than a single connection string.
- Firebase Auth lives in a Firebase-branded console despite being the same project, which
  can feel like a second vendor even though the bill is one.
- **Nothing in this repo's GCP config has been executed.** It is written from the service
  contracts, not validated against a live project. Expect to correct details on first
  deploy.

## Open

- **Transactional email provider** — still undecided, and blocking before auth ships.
- **Project ID, instance names and service-account identities** are placeholders in
  `service.yaml`, `migrate-job.yaml` and `cloudbuild.yaml`.
- Whether to put Cloud CDN in front of Cloud Storage, given it reintroduces a load balancer.
- Whether web eventually moves to Cloud Run for full consolidation.

## Revisit if

- Sustained traffic makes the fixed-cost comparison against AWS irrelevant
- Video hosting enters scope (ADR 0004 chose links, not uploads — that assumption holds the
  storage bill down)
- Multi-region or strict data-residency attestation becomes a requirement
