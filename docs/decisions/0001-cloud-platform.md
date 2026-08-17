# ADR 0001 — Cloud platform for API, database and storage

**Status:** Accepted (amended by [ADR 0004](0004-hybrid-platform.md) for identity)
**Date:** 2026-08-17

---

## Context

The backend and database move to the cloud. Constraints as they actually stand:

- **Product**: a fighter listing platform — profiles, events/cards, rankings. No video
  streaming, no live scoring, no public user accounts in v1.
- **Audience**: primarily India.
- **Traffic shape**: low baseline (thousands/day) with **large, brief spikes on fight
  nights** — plausibly 50–100× baseline for a few hours, roughly a dozen times a year.
  Overwhelmingly read-heavy; writes come from a handful of admins.
- **Team**: small, no dedicated infrastructure person.
- **Cost**: not the primary constraint. A few dollars a month is acceptable.
- **Priority**: must scale without a re-architecture.
- **Existing code**: Fastify + Prisma as a long-running container; Next.js web; Expo mobile.

## Decision

**Keep PostgreSQL.** Host as:

| Component | Platform | Region |
|---|---|---|
| Web | Vercel | Edge/global |
| API | Fly.io | Mumbai (`bom`) |
| Postgres + object storage | Supabase Pro | Mumbai (`ap-south-1`) |
| Auth | Identity Platform (GCP) — see [ADR 0004](0004-hybrid-platform.md) | Global |
| Mobile builds | EAS | — |

Approximately $30–50/month. Identity is **not** on Supabase.

## Rationale

### Keep Postgres

The data is aggressively relational — `Fighter ↔ Fight ↔ Event ↔ Ranking`, where nearly
every read is a join. A document store would force either denormalizing fighter data into
every fight (and chasing every copy on a rename) or hand-rolling joins in application code.

The schema also depends on enums (`WeightClass`, `FightStatus`, `FightOutcome`,
`EventStatus`), and `FightOutcome` in particular is what resolves the ambiguous-winner
problem in the data model. SQLite-backed options (Turso, Cloudflare D1) have no native enum
type, so Prisma cannot model them — we would fall back to bare strings, reintroducing the
exact class of bug the enums fix.

Postgres is also the anti-lock-in choice: every host supports it, so changing vendors later
is a dump and restore rather than a rewrite.

### Co-locate API and database

This drove the vendor choice more than anything else. A page render issues several
sequential queries. API and DB in different regions makes each one pay cross-region round
trip (~50ms India↔Singapore), and they compound. Co-located, it is ~1ms.

Neon, Railway and Render have **no India region** — pairing any of them with Mumbai compute
would split the pair. Supabase (Mumbai) and Fly.io (Mumbai) is the combination that keeps
them together.

Note: Fly's own Managed Postgres is not offered in Mumbai, which is why the database comes
from Supabase rather than Fly.

### Why Supabase specifically

- Only convenience-tier managed Postgres with a Mumbai region
- **Supavisor** connection pooling built in — see Consequences, this is load-bearing
- Read replicas and vertical compute scaling available on Pro
- Bundles **object storage**, so fighter/event images need no separate vendor
- Runs on AWS underneath, so a future move to raw AWS is a smaller step than it sounds

### Why not AWS or GCP

The extra ceiling is real but irrelevant at this scale, and it is not free: VPCs, IAM,
security groups and Terraform become a tax on every subsequent change. Cloud SQL and RDS
also do not scale to zero, so the floor is higher before serving a single request.

This would be the right call for a streaming/media product with multi-region active-active
needs. That is explicitly not what is being built.

### Alternatives considered

| Option | Why not |
|---|---|
| DigitalOcean App Platform + Managed Postgres, Bangalore | Genuinely viable — one vendor, one bill, both in India. Rejected only because Supabase bundles object storage and has a $0 path for early development. Reasonable fallback. |
| Railway / Render + Neon (Singapore) | Simpler DX, but no India region; adds ~40–60ms to uncached requests and splits API from DB unless both sit in Singapore. |
| AWS (Aurora + ECS + CloudFront) | Ops burden unjustified at this scale; higher cost floor. |
| Supabase all-in (PostgREST + RLS, no Fastify) | Would discard the existing API and push business logic into RLS policies, which are harder to test. The result-recording invariant belongs in application code. |
| Non-Postgres engines (Mongo, Firestore, Turso, D1) | Loses relational integrity, enums, and portability. See above. |

## Consequences

### Positive
- API and DB co-located in Mumbai; low query latency
- Existing Fastify + Prisma code runs unchanged — no serverless restructuring
- Object storage bundled with the database vendor
- Clear vertical scaling path that needs no infrastructure hire
- Plain Postgres keeps exit costs low

### Negative / to manage
- **Three vendors** (Vercel, Fly, Supabase) rather than one dashboard
- Supabase **free tier pauses after ~7 days with no requests** — fine for a live site,
  awkward during development gaps. Pro removes this.
- **A connection pooler is mandatory, from day one.** Prisma opens a pool per instance;
  scaling to several API containers during a fight-night spike exhausts Postgres
  connections long before CPU. Use Supavisor. Retrofitting this during an outage is
  miserable.
- Fly machines scaled to zero have cold starts — keep at least one always-on.

## Scaling plan

Ordered by actual impact, not intuition:

1. **Edge caching (ISR + CDN)** — the dominant lever. Fight-night spikes hit Vercel's edge,
   collapsing thousands of readers into a handful of origin renders.
2. **Connection pooling** — the first thing that actually breaks. Non-negotiable.
3. **Read replicas** — rankings and profiles are pure reads and replicate trivially.
4. **Horizontal API scaling** — Fastify is stateless with JWT auth, so this is just more
   containers.
5. **Vertical DB scaling** — boring, and goes further than expected.

| Load | Action |
|---|---|
| Launch → ~10k daily | Default setup: one API instance, micro DB |
| Fight-night spikes | Tune ISR revalidation; Fly autoscales containers. DB untouched. |
| ~100k daily | Bump Supabase compute a tier; add a read replica |
| Beyond | Multiple API regions, replica per region |

### Constraints this imposes on application design

These matter more than the vendor choice, because they are what would *block* scaling later:

- **Stateless API** — JWT only, no in-memory sessions
- **Never** store images in Postgres or on container disk — object storage only
- **Watch N+1 queries** — an event page fetching fighters in a loop is what melts under
  spike, not infrastructure
- **Version the API** (`/v1`) — mobile clients in the wild cannot be force-upgraded
- **Pooler in place before launch**

## Revisit if

- Video streaming enters scope
- Sustained traffic exceeds ~100k daily readers
- Multi-region active-active or strict data-residency compliance becomes a requirement
