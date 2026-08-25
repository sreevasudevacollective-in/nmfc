# NMFC

Fighter profiles, events, and rankings — web + mobile, monorepo.

Maintainer: [AKHIL](https://github.com/akhilbellam)

## Branching strategy

`main` is production. Keep it clean. Integration happens on `develop`. Do not commit to either directly.

| Branch | Purpose |
| --- | --- |
| `main` | Production. Update **only** by merging `develop` (release PR). |
| `develop` | Integration. All work lands here. |
| `feature/<short-name>` | New work (e.g. `feature/fighter-profile`). |
| `fix/<short-name>` | Bug fixes (e.g. `fix/rankings-sort`). |
| `chore/<short-name>` | Tooling, deps, docs (e.g. `chore/prisma-migrate`). |
| `hotfix/<short-name>` | Urgent patch. Branch from `develop`, PR into `develop`, then promote. |

**Workflow**

1. Branch from the latest `develop`.
2. Keep branches short-lived and focused on one change.
3. Open a pull request into **`develop`**. Request review before merge.
4. Squash-merge into `develop` when the PR is approved and CI is green.
5. Delete the branch after merge.
6. When releasing: open a PR **`develop` → `main`**. Use a merge commit (do not squash).

Do not use long-lived personal or agent branches (`main-*`, `akhil-*`). If work is unfinished, keep it on a named `feature/` or `fix/` branch and open a draft PR into `develop`.

GitHub Actions enforces this on every pull request ([`.github/workflows/branch-policy.yml`](.github/workflows/branch-policy.yml)): work PRs must target `develop` and the head must match `feature|fix|chore|hotfix/<short-name>`. The only PR allowed into `main` is from `develop`. Mark **Enforce branching strategy** as a required status check on **`develop`** and **`main`**.

## Structure

- `apps/web` — Next.js (Tailwind, TypeScript). Public site + admin.
- `apps/api` — Fastify + Prisma API, shared by web and mobile.
- `apps/mobile` — Expo (React Native) app.
- `packages/shared` — shared TypeScript types (`Fighter`, `Event`, `Fight`, `Ranking`).

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
cd apps/api && npx prisma migrate dev
```

Optional — load sample fighters/events/rankings:

```bash
cd apps/api && npx tsx prisma/seed.ts
```

## Run locally

```bash
npm run dev:web       # Next.js on http://localhost:3001
npm run dev:api       # Fastify on http://localhost:4000
npm run dev:mobile    # Expo dev server (scan QR with Expo Go)
```

## API endpoints

All under `/v1` except `/health`, which is an infra probe rather than a data contract.
(Public reads were unversioned until this was fixed — if you have an old bookmark or
integration hitting bare `/fighters` etc., it now 404s.)

Public:

- `GET /health`
- `GET /v1/fighters?league=` — optionally filtered by league slug
- `GET /v1/events?league=` (includes fights and league)
- `GET /v1/rankings/:weightClass?league=` (e.g. `LIGHTWEIGHT`)
- `GET /v1/leagues?kind=` — home leagues + partnered directory, optionally filtered to `HOME` or `PARTNERED`
- `GET /v1/products` — merch catalog
- `POST /v1/sponsor-inquiries` — public write, no auth (contact form, not a CRM)

Applicant, requires a signed-in Identity Platform JWT:

- `GET/PUT /v1/applications/me`, `POST /v1/applications/me/submit` — submit now requires a
  `leagueId` naming a real `HOME` league; the form fetches `/v1/leagues?kind=HOME` to populate
  the select

Admin, requires `User.role = ADMIN` (see **Admin access** below):

- `GET /v1/admin/applications?status=`, `POST /v1/admin/applications/:id/accept`,
  `POST /v1/admin/applications/:id/reject`

## Admin access

There's no signup flow that grants `ADMIN` — it has to be bootstrapped. Set `ADMIN_EMAILS`
(comma-separated) in `apps/api/.env`; whoever signs in with a listed email is promoted to
`ADMIN` on that sign-in. Promote-only — removing an email later doesn't demote an existing
admin. Details: [ADR 0007](docs/decisions/0007-admin-role.md).

Dashboard: `/admin` on the web app. Lists applications pending review with accept/reject.

## Data model

`Fighter`, `Event`, `Fight`, `Ranking` (roster and cards); `User`, `FighterApplication`,
`FighterProfile`, `AuditLog` (accounts and intake — [ADR 0003](docs/decisions/0003-fighter-accounts.md),
[ADR 0005](docs/decisions/0005-fighter-applications.md)); `League`, `FighterLeague` (home
leagues + partnered directory — [ADR 0006](docs/decisions/0006-leagues.md)); `SponsorInquiry`,
`Product` (thin content models, no workflow). See `apps/api/prisma/schema.prisma`.

Prisma 7 keeps the connection URL in `apps/api/prisma.config.ts` (not the schema), and the
runtime client requires the `@prisma/adapter-pg` driver adapter.

## Pending / TODO

- [x] Provision Postgres and set `DATABASE_URL` in `apps/api/.env`
- [x] Run initial Prisma migration
- [x] Public accounts + admin auth: Identity Platform, `requireAdmin`, `ADMIN_EMAILS`
      bootstrap (ADR 0004, ADR 0007) — superseded the earlier "simple password gate" plan
- [x] Fighter self-service application intake, admin review dashboard at `/admin`
      (ADR 0005) — `/apply` and `/admin` are both wired and working
- [x] Leagues: three home leagues + partnered directory (ADR 0006)
- [x] **League field on the application form.** Submit now requires a `leagueId` naming a
      real `HOME` league; acceptance places the fighter in the league they actually applied
      to. The flagship-default fallback survives only for the handful of applications
      submitted before this field existed (`leagueId` null) — see ADR 0006's Revisit note
- [x] Fix API versioning inconsistency — all public reads moved under `/v1`; `/health`
      stays bare deliberately (infra probe, not a data contract)
- [ ] Run and verify the mobile app in Expo Go / simulator (scaffolded but not yet launched)
- [ ] Build admin CRUD for roster/event content (create/edit fighters, events, fight
      results, ranking reorder) — distinct from application review, which is done
- [ ] Build public pages: fighter profile, event page, rankings page — a fighters *list*
      exists at `/fighters`; profile, event, and rankings pages don't yet
- [ ] Decide ranking method: manually set vs. auto-computed from win/loss
- [ ] Fighter photo storage: local/public folder for now, or Supabase storage / S3-compatible bucket later
- [ ] Deploy: web → Vercel, API → Fly Mumbai, DB + files → Supabase Mumbai, auth → Identity Platform (ADR 0004)
