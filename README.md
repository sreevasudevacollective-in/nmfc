# NMFC

Fighter profiles, events, and rankings — web + mobile, monorepo.

## Structure

- `apps/web` — Next.js (Tailwind, TypeScript). Public site + admin.
- `apps/api` — Fastify + Prisma API, shared by web and mobile.
- `apps/mobile` — Expo (React Native) app.
- `packages/shared` — Zod schemas and the TypeScript types inferred from them. One
  definition of the API contract, consumed by the API, web, and mobile.

## Design

- [docs/system-design.md](docs/system-design.md) — architecture, data model, API surface,
  auth, deployment, and build order.
- [docs/decisions/](docs/decisions/) — architecture decision records.

## Prerequisites

- Node.js 20+
- PostgreSQL 16 (macOS: `brew install postgresql@16 && brew services start postgresql@16`)

## Setup

```bash
npm install
createdb nmfc
cp apps/api/.env.example apps/api/.env   # set DATABASE_URL to your local Postgres
npm run build:shared                     # the API imports @nmfc/shared from dist/
npm run migrate                          # apply migrations
npm run seed                             # optional: 12 fighters, 3 events, rankings
```

The seed is idempotent — re-running it updates in place rather than duplicating.

## Run locally

```bash
npm run dev:web       # Next.js on http://localhost:3001
npm run dev:api       # Fastify on http://localhost:4000
npm run dev:mobile    # Expo dev server (scan QR with Expo Go)
```

If you change `packages/shared`, re-run `npm run build:shared` (or
`npm run dev --workspace=packages/shared` to watch).

## API

Versioned under `/v1` from day one — mobile clients in the wild can't be force-upgraded.
Public reads are unauthenticated. Public lookups are by **slug**; ids are for admin
mutations.

```
GET /health
GET /v1/fighters?weightClass=&q=&page=&limit=    list + search
GET /v1/fighters/:slug                            profile + fight history
GET /v1/events?status=&page=&limit=               list
GET /v1/events/:slug                              event + full card, main event first
GET /v1/rankings                                  all divisions
GET /v1/rankings/:weightClass                     one division
```

Lists return `{ data, page, limit, total }`. Errors return
`{ error: { code, message, details? } }` with a matching HTTP status.

## Data model

`Fighter`, `Event`, `Fight`, `Ranking`, plus `User`, `FighterProfile` and `AuditLog` for
fighter accounts, and `Application` (with `ApplicationExperience` / `ApplicationVideo`) for
intake — see `apps/api/prisma/schema.prisma`.

Three rules worth knowing before touching it:

- **Fight records are derived, never stored.** `wins/losses/draws` are computed from `Fight`
  rows. The only stored counters are `prior*`, holding a fighter's record from other
  promotions. Displayed record = prior + derived.
- **Private data lives in `FighterProfile`, not `Fighter`.** The public API never queries
  that table, so private fields cannot leak into a public response by omission.
- **`Application` has no public endpoint at all.** Intake is open, but a `Fighter` row is
  created only when an admin accepts an application, so no unreviewed or rejected applicant
  is ever publicly visible. Self-reported records live in `claimed*` fields and are never
  copied automatically into `Fighter.prior*`.

Prisma 7 keeps the connection URL in `apps/api/prisma.config.ts` (not the schema), and the
runtime client requires the `@prisma/adapter-pg` driver adapter.

## Pending / TODO

- [x] Provision Postgres and set `DATABASE_URL` in `apps/api/.env`
- [x] Run initial Prisma migration
- [x] Schema revisions: outcome enum, slugs, derived records, indexes, cascades
- [x] Public read API with Zod validation and shared types
- [x] Decide ranking method — manual for v1, admin-ordered
- [x] Weight classes — men's divisions only in v1, single ruleset
- [x] Fighter intake fields — settled by the eligibility form (ADR 0004)
- [x] Intake rules — under-18 blocked, locked on submission, non-accepted applications
      retained as a talent pipeline (ADR 0004)
- [ ] **Retention window length** — the mechanism exists (`minimisedAt`, `retainUntil`), the
      numbers don't. Needed before intake goes live, along with the consent notice that
      discloses the retention purpose
- [ ] Decide whether coach verification needs a real coach-side flow (currently applicant
      self-entry, which carries no independent weight)
- [ ] Decide how the first `ADMIN` account is created (deferred; blocks Phase 4)
- [ ] Is there existing fighter/event data to import?
- [ ] Build the application form + admin review queue (needs auth first)
- [ ] Connect web frontend to the API (currently still the Next.js starter page)
- [ ] Build public pages: fighter profile, event page, rankings, home, search
- [ ] Admin auth + CRUD (create/edit fighters, events, fight results, ranking reorder)
- [ ] Fighter claim flow and self-service profile editing (ADR 0003)
- [ ] Fighter photo storage: Supabase Storage with presigned uploads (schema stores keys,
      not URLs)
- [ ] Run and verify the mobile app in Expo Go / simulator (scaffolded but not yet launched)
- [ ] Custom SMTP before launch — Supabase's built-in email is test-only (2/hour)
- [ ] Deploy: web → Vercel, API → Fly.io Mumbai, DB + storage → Supabase Mumbai
