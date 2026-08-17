# NMFC — agent workflow

Read this file at the start of **every** prompt before planning or writing code.
If anything here conflicts with a README, follow this file and `docs/` (ADRs win).

## 1. Orient

1. Restate the user ask in one sentence.
2. Open the relevant docs (do not rely on memory of the repo):
   - Root [`README.md`](../README.md) — how to run the monorepo
   - [`docs/system-design.md`](../docs/system-design.md) — architecture and **build order**
   - [`docs/decisions/`](../docs/decisions/) — settled ADRs (platform, auth, fighter accounts)
3. Ignore stale README TODOs when an ADR already decided (rankings = manual v1; auth = Supabase; deploy = Vercel + Fly Mumbai + Supabase Mumbai).
4. `apps/web/README.md` is create-next-app boilerplate; the root README is the source of truth for run commands.

## 2. Branch

Never commit to `main` or `develop`. `main` is production; keep it clean. All work PRs target **`develop`**.

Branch from latest `develop`:

| Prefix | Use |
| --- | --- |
| `feature/<short-name>` | New product work |
| `fix/<short-name>` | Bugs |
| `chore/<short-name>` | Tooling, deps, docs, CI |
| `hotfix/<short-name>` | Urgent production patch (still PR into `develop`, then promote) |

Lowercase kebab-case only (`feature/fighter-profile`). No `main-*` or personal branches.

GitHub Actions [`.github/workflows/branch-policy.yml`](workflows/branch-policy.yml): work PRs must target `develop` with a prefixed head; the only PR allowed into `main` is `develop` itself.

Do **not** commit or push unless the user asks.

## 3. Build order

Do not skip phases. Current scaffold is API reads + Next/Expo starters.

1. **Data** — schema revisions in system-design §3.2, migration, seed
2. **API** — `/v1` public reads, Zod, types via `packages/shared`
3. **Web public** — home, fighter, event, rankings (SEO)
4. **Admin** — auth then CRUD, results, ranking reorder, uploads
5. **Mobile** — Expo against the same API (read-only v1)
6. **Deploy** — CI, production hosts

If the user asks for a later phase, say what must land first, then do the smallest slice they still want.

## 4. Code

- Monorepo: `apps/web` (Next.js, port **3001** via `npm run dev:web`), `apps/api` (Fastify, **4000**), `apps/mobile` (Expo), `packages/shared`.
- API: routes parse/validate only; Prisma stays in `db/`; business rules in `services/`. Do not grow `apps/api/src/index.ts` into a god file.
- Public URLs use **slugs**; admin mutations use **ids**.
- Validate request bodies with Zod. Prefer types inferred from Zod over hand-copied `packages/shared` types.
- Do not add features marked out of v1 (phone OTP, live scoring, ticketing, comments).
- Do not weaken CORS, commit secrets, or store images in git/Postgres.
- Match existing style; no drive-by refactors or extra markdown unless asked.

## 5. After the work

- Summarize what changed and what is still open.
- If the user wants a PR: branch name, commit, push, `gh pr create --base develop`.
- If the user wants a **release**: PR `develop` → `main` (merge commit, not squash). Never open feature/fix/chore PRs to `main`.
