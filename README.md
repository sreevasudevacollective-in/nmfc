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

- `GET /health`
- `GET /fighters`
- `GET /events` (includes fights)
- `GET /rankings/:weightClass` (e.g. `LIGHTWEIGHT`)

## Data model

`Fighter`, `Event`, `Fight`, `Ranking` — see `apps/api/prisma/schema.prisma`.

Prisma 7 keeps the connection URL in `apps/api/prisma.config.ts` (not the schema), and the
runtime client requires the `@prisma/adapter-pg` driver adapter.

## Pending / TODO

- [x] Provision Postgres and set `DATABASE_URL` in `apps/api/.env`
- [x] Run initial Prisma migration
- [ ] Run and verify the mobile app in Expo Go / simulator (scaffolded but not yet launched)
- [ ] Connect web frontend to the API (currently still the Next.js starter page)
- [ ] Build admin CRUD (create/edit fighters, events, fight results)
- [ ] Build public pages: fighter profile, event page, rankings page
- [ ] Decide ranking method: manually set vs. auto-computed from win/loss
- [ ] Fighter photo storage: local/public folder for now, or Supabase storage / S3-compatible bucket later
- [ ] Admin auth (simple password gate to start; no public user accounts in v1)
- [ ] Deploy: web → Vercel, API → Fly Mumbai, DB + files → Supabase Mumbai, auth → Identity Platform (ADR 0004)
