# NMFC

Fighter profiles, events, and rankings — web + mobile, monorepo.

## Structure

- `apps/web` — Next.js (Tailwind, TypeScript). Public site + admin.
- `apps/api` — Fastify + Prisma API, shared by web and mobile.
- `apps/mobile` — Expo (React Native) app.
- `packages/shared` — shared TypeScript types (`Fighter`, `Event`, `Fight`, `Ranking`).

## Design

[docs/system-design.md](docs/system-design.md) — architecture, data model, API surface,
auth, deployment, and build order.

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
- [ ] Deploy: web → Vercel free tier, API + DB → Render/Fly.io + Supabase/Neon free tier
