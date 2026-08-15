# NMFC

Fighter profiles, events, and rankings — web + mobile, monorepo.

## Structure

- `apps/web` — Next.js (Tailwind, TypeScript). Public site + admin.
- `apps/api` — Fastify + Prisma API, shared by web and mobile.
- `apps/mobile` — Expo (React Native) app.
- `packages/shared` — shared TypeScript types (`Fighter`, `Event`, `Fight`, `Ranking`).

## Prerequisites

- Node.js 20+
- PostgreSQL (local via Docker/Postgres.app, or a free-tier host like Supabase/Neon)

## Setup

```bash
npm install
cp apps/api/.env.example apps/api/.env   # set DATABASE_URL
npm run dev:api --workspace=apps/api -- prisma migrate dev   # or: cd apps/api && npx prisma migrate dev
```

## Run locally

```bash
npm run dev:web      # Next.js on http://localhost:3000
npm run dev:api       # Fastify on http://localhost:4000
npm run dev:mobile    # Expo dev server (scan QR with Expo Go)
```

## Data model

`Fighter`, `Event`, `Fight`, `Ranking` — see `apps/api/prisma/schema.prisma`.

## Pending / TODO

- [ ] Provision Postgres (local Docker/Postgres.app, or free-tier Supabase/Neon) and set `DATABASE_URL` in `apps/api/.env`
- [ ] Run initial Prisma migration (`npx prisma migrate dev` in `apps/api`)
- [ ] Run and verify the mobile app in Expo Go / simulator (scaffolded but not yet launched)
- [ ] Build admin CRUD (create/edit fighters, events, fight results)
- [ ] Build public pages: fighter profile, event page, rankings page
- [ ] Decide ranking method: manually set vs. auto-computed from win/loss
- [ ] Fighter photo storage: local/public folder for now, or Supabase storage / S3-compatible bucket later
- [ ] Admin auth (simple password gate to start; no public user accounts in v1)
- [ ] Deploy: web → Vercel free tier, API + DB → Render/Fly.io + Supabase/Neon free tier
