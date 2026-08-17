# ADR 0004 — Hybrid platform (final)

**Status:** Accepted
**Date:** 2026-08-17
**Supersedes:** auth choice in [ADR 0002](0002-authentication.md)
**Amends:** [ADR 0001](0001-cloud-platform.md) — compute, Postgres, and storage unchanged; identity is no longer on Supabase

---

## Decision

One seam only: **GCP issues login tokens. Everything that stores data stays on Supabase in Mumbai. The API stays a container next to that database.**

Do not put the API on Cloud Run, files on GCS, or Postgres on Cloud SQL while the rest is still on Supabase. Those splits are what make hybrid painful.

| Job | Service | Region |
|---|---|---|
| Auth | **Identity Platform** (Firebase Authentication on a GCP project) | Global |
| Postgres | **Supabase Pro** + **session pooler** (Supavisor) | Mumbai (`ap-south-1`) |
| Images | **Supabase Storage** (same project as the DB) | Mumbai |
| API | **Fly.io** (existing Docker image) | Mumbai (`bom`) |
| Web | **Vercel** (Next.js, ISR/CDN) | Edge / global |
| Mobile builds | **EAS** | — |
| Transactional email | **Resend** (SMTP into Identity Platform) | — |
| Secrets | Fly secrets + Vercel env | — |
| DNS | Existing registrar / Cloudflare | `api` → Fly, apex/www → Vercel |

**Steady cost at ~1,000 fighters:** about **$30–50/month** (Supabase Pro ~$25, Fly ~$4, Vercel $0–20, Identity Platform $0 until 50k MAU).

```
Users / Expo
    │
    ├─ sign-in ──► Identity Platform  (email + Google → JWT)
    │
    └─ HTTPS ───► Vercel (web) ──┐
                                 ├─► Fly Fastify (bom)
                      Expo API ──┘         │
                         verify JWT ───────┤── Identity Platform JWKS
                         Prisma + pooler ──┤── Supabase Postgres
                         object keys ──────┘── Supabase Storage
```

## Why this hybrid

- **1,000 fighter signups** are a small database, not a traffic event. Auth MAU and row count do not justify Cloud SQL.
- Fight-night scale is **readers**, handled by Vercel ISR/CDN + more Fly machines. The database is untouched if the pooler is in place.
- The **hard** later move to GCP is identity, not Postgres. Identity Platform now means a future Cloud SQL cutover is dump/restore + new URLs; user UIDs stay stable.
- Fastify already only **verifies** JWTs. The issuer can be Identity Platform without changing the API shape, Prisma, or RLS policy (there is none).

## Auth rules

| Concern | Choice |
|---|---|
| Provider | Identity Platform (email/password + Google) |
| Phone / SMS OTP | Out of v1 |
| Email delivery | Resend via Identity Platform SMTP — not Google’s default mail |
| Admins | Same IdP; elevated role on the local `User` row / custom claims |
| API | Fastify verifies the Identity Platform JWT (JWKS). No `/v1/auth/login`. |
| Data | Prisma only. **No RLS.** The API is the only database client. |
| Local user | Thin `User` keyed by Identity Platform `sub` (`authUid`) + `role` |
| Web sessions | Prefer Firebase **session cookies** (httpOnly) for SSR; never store refresh tokens in `localStorage` |
| Mobile | Firebase Auth SDK; tokens in `expo-secure-store` |

Do **not** use: IAP, Cloud Identity / Workspace, Supabase Auth, or self-rolled passwords in Fastify.

Account linking (Google vs email at the same address) remains an explicit product choice — Identity Platform can link identities; pick one behavior before launch.

## Data and files

- Postgres stays on Supabase. Use the **session pooler** connection string in production (`DATABASE_URL`). Prisma opens a pool per Fly machine; the direct port will exhaust connections when the API scales on fight night.
- Images stay in **Supabase Storage**. Store **keys**, not full URLs. Presigned upload via the API; the API never proxies bytes.
- Do not store images in git, container disk, or Postgres.

## Compute

- API: Fly `bom`, `min_machines_running = 1`, `prisma migrate deploy` as `release_command` (never at boot). See [`apps/api/fly.toml`](../../apps/api/fly.toml).
- Web: Vercel. Public pages ISR (~5 min). Admin uncached.
- Mobile: EAS. Same API. Read-only in v1.

## What this is not

| Split | Why not |
|---|---|
| Cloud Run API + Supabase DB | Extra IAM/VPC for no scale win; risk of splitting region |
| GCS + Supabase Postgres | Two buckets, two URL schemes |
| Supabase Auth + Identity Platform | Two user directories |
| Cloud SQL + Identity Platform “because GCP” | Higher always-on floor; 1,000 fighters do not need it |

## Later move to GCP (optional)

When (if) compute and data also move:

1. `pg_dump` → Cloud SQL (Mumbai).
2. Copy Storage → GCS; keys unchanged if we stored keys.
3. Point Fly or Cloud Run at the new `DATABASE_URL` and bucket.
4. Auth is already on Identity Platform — **no user remapping**.

Until then, do not add Cloud SQL, Cloud Run, GCS, or Secret Manager.

## Application constraints (load-bearing)

- Stateless API (JWT only).
- `/v1` versioned; public by slug, admin by id.
- Pooler from day one.
- No N+1 on event cards.
- CORS allowlist in production (`CORS_ORIGINS`).

## Revisit if

- GCP becomes a hard org requirement for **data** (not just identity) — then supersede this ADR and move Postgres + storage together, not piecemeal.
- Phone OTP returns (TRAI DLT + SMS provider; Identity Platform bills per SMS).
- Sustained traffic exceeds ~100k daily readers — bump Supabase compute / add a replica first, same as ADR 0001.
