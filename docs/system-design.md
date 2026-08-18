# NMFC — System Design

Design for the NMFC fighter/event/rankings platform: one shared API serving a web app and a
mobile app, backed by Postgres.

Status: proposed. Sections marked **Decision** need your sign-off before implementation.

---

## 1. Scope

**v1 (in scope)**
- Fighter profiles — bio, physical stats, career record, fight history
- Events and fight cards — upcoming and past, with matchups and results
- Rankings — per weight class
- **Admin dashboard** (web) — create and manage the roster, events, results, rankings
- **Accounts** — sign-up via email and Google ([ADR 0004](decisions/0004-hybrid-platform.md))
- **Fighter self-service** — open apply, admin review/accept ([ADR 0005](decisions/0005-fighter-applications.md));
  accepted fighters maintain fighter-owned fields ([ADR 0003](decisions/0003-fighter-accounts.md))

**Explicitly out of v1**
- Phone / SMS OTP login — deferred; requires TRAI DLT registration in India
- Predictions, comments, forums
- Live/round-by-round scoring
- Ticketing or payments
- Multi-promotion data (NMFC only)

> **Open:** accounts exist, but no logged-in features are yet defined. What sign-up unlocks
> needs settling before the `User` profile model is built — see ADR 0002.

**Non-functional targets**

| Concern | Target |
|---|---|
| Scale | Hundreds of fighters, tens of events/year, low thousands of daily readers |
| Read/write ratio | Overwhelmingly read-heavy; writes only from a handful of admins |
| Latency | Public pages < 500ms server response |
| Availability | Best-effort; a few minutes of downtime is acceptable |
| Cost | ~$30–50/month ([ADR 0004](decisions/0004-hybrid-platform.md)) |

The scale target matters: this is a **content site**, not a high-traffic transactional system.
It justifies simple choices — one API instance, one Postgres, no cache layer, no queue.

---

## 2. Architecture

```mermaid
flowchart TB
    subgraph Clients
        W["Web — Next.js<br/>SSR/ISR public pages + admin"]
        M["Mobile — Expo/React Native<br/>iOS + Android"]
    end

    subgraph Backend
        A["API — Fastify<br/>REST + JWT auth"]
        DB[("PostgreSQL<br/>Prisma")]
        S["Object storage<br/>fighter/event images"]
    end

    W -->|"HTTPS, server-side fetch"| A
    M -->|"HTTPS"| A
    A --> DB
    A --> S
    W -.->|"direct image URLs"| S
    M -.->|"direct image URLs"| S
```

**Why a separate API rather than Next.js route handlers**: the mobile app needs the same
data. Putting business logic in Next.js would force mobile to either duplicate it or depend
on the web deployment. One Fastify service keeps a single source of truth for both clients.

**Layering inside the API** — keep it thin but separated:

```
apps/api/src/
  routes/        HTTP concerns only: parse, validate, serialize
  services/      business logic: rankings, record computation, result recording
  db/            Prisma client + query helpers
  auth/          JWT issue/verify, admin guard
  schemas/       Zod request/response schemas (source of shared types)
```

Route handlers should not touch Prisma directly. Result recording in particular
(§5) has real invariants and belongs in a service.

---

## 3. Data model

Fighter accounts add `User`, `FighterProfile` (private PII, deliberately a separate table)
and `AuditLog`. Their shape and the field-ownership rules are in
**[ADR 0003](decisions/0003-fighter-accounts.md)** — read it before touching `Fighter`.

### 3.1 Problems with the current schema

The scaffold schema works but has gaps that get expensive to fix once real data exists:

| # | Issue | Consequence |
|---|---|---|
| 1 | `Fight.winnerId` is a bare `String`, not a relation | Can reference a fighter who isn't in the fight, or a deleted one. No DB-level integrity. |
| 2 | Outcome is implied by `winnerId == null` | Ambiguous — is it a draw, a no-contest, or not yet fought? Three very different states. |
| 3 | `wins/losses/draws` stored on `Fighter`, also derivable from `Fight` | Two sources of truth. They will drift. |
| 4 | `@@unique([weightClass, rank])` | Reordering rankings collides mid-update. Swapping ranks 1 and 2 fails without temp values or deferred constraints. |
| 5 | No slugs | URLs are `/fighters/cmsw5mab70000yzr7`. Bad for SEO and unshareable — a fight site lives on search traffic. |
| 6 | `Event.status` is a free-form `String` | Typos become data ("Scheduled" vs "scheduled"). |
| 7 | No bout ordering on a card | Can't express main event vs prelims, or display a card in the right order. |
| 8 | No indexes on `Fight.eventId`, `Event.date`, `Fighter.weightClass` | Fine at current size, but these are every hot query path. |

### 3.2 Proposed schema changes

**Outcome as an explicit enum** — replaces the ambiguous nullable winner:

```prisma
enum FightStatus {
  SCHEDULED
  COMPLETED
  CANCELLED
}

enum FightOutcome {
  WIN_A        // fighterA won
  WIN_B        // fighterB won
  DRAW
  NO_CONTEST
}
```

`Fight.status` starts `SCHEDULED` with `outcome = null`; recording a result sets
`status = COMPLETED` and a non-null `outcome`. A `WIN_*` outcome makes the winner
unambiguous without a foreign key that could point anywhere.

**Other changes:**
- `Fight.boutOrder Int` — display order on the card; highest is the main event
- `Fight.isTitleFight Boolean @default(false)` — title fights render differently and matter for rankings
- `Event.status` → enum (`SCHEDULED | COMPLETED | CANCELLED`)
- `slug String @unique` on `Fighter` and `Event`, generated from name with a numeric suffix on collision
- `Ranking`: drop `@@unique([weightClass, rank])`, keep `@@unique([weightClass, fighterId])`.
  Uniqueness of *rank* is enforced in the service on write, not by the DB — this makes
  reordering a single transaction instead of a constraint dance.
- Indexes on `Fight.eventId`, `Event.date`, `Fighter.weightClass`, plus the slug uniques
- `Fighter.photoUrl` → `photoKey`, and `Event.posterKey` added — store the storage **key**,
  not a full URL, so the CDN domain can change without a data migration (§7)
- `onDelete: Cascade` on `Fight.event` and `Ranking.fighter`

### 3.3 Fighter record — **Decision**

The `wins/losses/draws` fields duplicate what `Fight` rows already say. Three options:

| Option | How | Trade-off |
|---|---|---|
| **A. Derive on read** | Compute from `Fight` rows each query | Always correct; no drift possible. Extra aggregate per fighter page — negligible at our scale. |
| **B. Denormalized cache** | Keep columns, recompute in the same transaction that records a result | Fast reads. Can drift if any write path forgets; needs a periodic reconciliation job. |
| **C. Hybrid** | Derive as the source of truth, cache into the columns for list views | Best of both, most code. |

**Recommendation: A.** At hundreds of fighters this is a trivial query, and correctness for
free is worth more than micro-optimized reads. Revisit only if a listing page gets slow.

There's a wrinkle either way: fighters usually have a **pre-NMFC record** from other
promotions. That can't be derived from our `Fight` table. Suggest explicit
`priorWins / priorLosses / priorDraws` columns, with the displayed record being
prior + derived-from-NMFC. This keeps "imported history" and "what we recorded"
cleanly separated.

---

## 4. API design

REST over HTTPS, JSON. Versioned under `/v1` from day one — cheap now, and mobile clients
in the wild can't be force-upgraded later.

### Public (unauthenticated, read-only)

```
GET  /v1/fighters?weightClass=&q=&page=      list + search
GET  /v1/fighters/:slug                       profile + fight history
GET  /v1/events?status=&page=                 list
GET  /v1/events/:slug                         event + full card, bouts ordered
GET  /v1/rankings                             all weight classes
GET  /v1/rankings/:weightClass                one division
```

### Admin (JWT required, admin role claim)

Login and token issuance are handled by Identity Platform, not by this API — there is no
`/v1/auth/login` endpoint. The API only *verifies* the JWT. See §8.

```
POST   /v1/admin/fighters          PATCH/DELETE /v1/admin/fighters/:id
POST   /v1/admin/events            PATCH/DELETE /v1/admin/events/:id
POST   /v1/admin/events/:id/fights     add bout to card
PATCH  /v1/admin/fights/:id/result     record outcome
PUT    /v1/admin/rankings/:weightClass full ordered list, replaces division
POST   /v1/admin/uploads               presigned URL for images
```

**Conventions**
- Public lookups by **slug**, admin mutations by **id**. Slugs are for humans and can change;
  ids are stable.
- Pagination: `?page=&limit=` with `{ data, page, limit, total }`. Offset paging is fine —
  no dataset here is large enough to need cursors.
- Errors: consistent `{ error: { code, message, details? } }`, correct HTTP status.
- Validation: **Zod** schemas at the boundary. Every request body validated before it
  reaches a service.
- Rankings replace the whole division in one `PUT` rather than per-row PATCHes — ranking is
  inherently an ordered list, and one atomic write avoids half-applied reorderings.

### Shared types

`packages/shared` currently hand-maintains types that duplicate the Prisma schema — they
will drift. Better: define Zod schemas in the API, infer TypeScript types from them, and
export those through `packages/shared` for web and mobile. One definition, validation and
types both derived from it.

---

## 5. Recording a result — the one real invariant

This is the only write with meaningful complexity, so it's worth specifying. Recording a
fight result must, **in a single transaction**:

1. Verify the fight is `SCHEDULED` (recording twice must not double-count)
2. Set `status = COMPLETED`, `outcome`, `method`, `round`, `time`
3. If the event's every bout is now complete, set the event `COMPLETED`

With derived records (§3.3 option A) there is no counter to update — a large part of why
that option is attractive. Rankings are **not** auto-updated here; see §6.

---

## 6. Rankings — **Decision**

| Option | Description | Trade-off |
|---|---|---|
| **Manual** | Admin sets the order per division | Total editorial control; matches how real promotions actually rank. Requires upkeep. |
| **Computed** | Algorithm from wins/losses/recency/opponent quality | Zero upkeep, but needs enough fights to be meaningful and will produce odd results early on. |

**Recommendation: manual for v1.** A new promotion has too few fights for any algorithm to
produce a credible ordering, and rankings are an editorial statement. The `PUT
/v1/admin/rankings/:weightClass` endpoint plus a drag-to-reorder admin UI covers it. Keep a
computed *suggestion* as a later enhancement — surface a proposed order, let the admin
accept or override.

---

## 7. Media storage

Fighter portraits and event posters. Requirements: cheap, works from both clients, no
credentials in the app bundle.

**Approach**: object storage with presigned uploads. Admin requests a presigned URL from
the API, uploads directly to storage, sends back the resulting key. The API never proxies
image bytes, and no storage credentials ever reach a client.

**Decided: Supabase Storage** (see [ADR 0001](decisions/0001-cloud-platform.md) and
[ADR 0004](decisions/0004-hybrid-platform.md)) — same project as Postgres. Do not put
files on GCS while the database is still on Supabase.
Cloudflare R2 remains a reasonable swap if egress ever becomes the dominant cost; storing
keys rather than URLs (below) keeps that migration cheap. Local filesystem is dev-only —
ephemeral on most hosts.

Store the **key**, not a full URL, so the CDN domain can change without a data migration.
Derive display URLs at read time. Generate a couple of preset sizes (thumbnail for lists,
full for profiles) at upload — mobile especially shouldn't download a 2MB portrait for a
40px avatar.

---

## 8. Auth

Public accounts **are** in scope. Full stack:
**[ADR 0004 — Hybrid platform](decisions/0004-hybrid-platform.md)** (supersedes
[ADR 0002](decisions/0002-authentication.md)).

**Identity Platform** (Firebase Authentication on GCP) handles both public users and admins.
Postgres and files stay on Supabase. Fastify only verifies the JWT.

| Concern | Choice |
|---|---|
| Methods (v1) | Email/password, Google OAuth |
| Phone / SMS OTP | Deferred — see ADR 0002/0004 before reintroducing |
| Transactional email | Resend SMTP into Identity Platform |
| Admin access | Same system, elevated role claim |
| API verification | Fastify verifies the Identity Platform JWT |

- Identity lives in Identity Platform; a thin local `User` profile row is keyed by
  the IdP UID (`sub`). Prisma still owns all application data.
- **No RLS.** It earns its keep when untrusted clients query Postgres directly; here the
  API is the only database client.
- A `requireAdmin` hook checks the role claim and guards every `/v1/admin/*` route.
  There is no separate `AdminUser` table.
- Mobile stores tokens in `expo-secure-store` — **never** `AsyncStorage`, which is
  plaintext on disk. Web prefers Firebase session cookies (httpOnly) for SSR.
- Rate-limit auth endpoints (`@fastify/rate-limit`).

Two things that must be handled before launch:

- **Custom SMTP (Resend).** Do not ship on Identity Platform’s default email.
- **Account linking.** Decide explicitly whether a Google signup and a later email/password
  signup at the same address are one account or two.

---

## 9. Web app

Next.js App Router. Rendering strategy per route type:

| Route | Strategy | Why |
|---|---|---|
| Fighter profile, event page | **ISR**, revalidate ~5 min | Content changes rarely; needs to be crawlable |
| Rankings | **ISR**, revalidate ~5 min | Same |
| Live event results | **SSR** or short revalidate | Freshness matters on fight night |
| Admin | **Client-side, no caching** | Authenticated, always current |

SEO is a first-class concern for a fight database — most traffic will arrive via searches
for a fighter's name. That means slug URLs (§3.2), per-page metadata, OpenGraph images, and
`Fighter`/`Event` JSON-LD structured data.

Data fetching happens **server-side** so the API URL and any tokens stay off the client.

---

## 10. Mobile app

Expo / React Native, sharing types (not UI) with web.

- **expo-router** for file-based navigation, mirroring web's structure
- **TanStack Query** for server state — caching, retries, and offline behavior for free
- Screens: Events (list → card detail), Fighters (search → profile), Rankings
- Read-only in v1; no admin on mobile
- Cache the last successful response so the app degrades gracefully on a bad connection at
  a venue
- Distribution via **EAS Build**. App Store/Play accounts are only needed at actual
  publish time ($99/yr Apple, $25 one-time Google)

---

## 11. Deployment

Compute, database, and storage: **[ADR 0001](decisions/0001-cloud-platform.md)**.
Identity and the hybrid seam: **[ADR 0004](decisions/0004-hybrid-platform.md)**.

| Component | Host | Region | Cost |
|---|---|---|---|
| Web | Vercel | Edge/global | $0–20 |
| API | Fly.io | Mumbai (`bom`) | ~$5 |
| Postgres + object storage | Supabase Pro | Mumbai (`ap-south-1`) | $25 |
| Auth | Identity Platform | Global | $0 until 50k MAU |
| Email | Resend | — | free tier, then usage |
| Mobile builds | EAS | — | $0 |

~$30–50/month. API and database are **co-located in Mumbai** — this is deliberate. A page
render issues several sequential queries, and splitting API from DB across regions makes
each one pay ~50ms of cross-region round trip. Neon, Railway and Render have no India
region, which is why they weren't chosen. Auth is the one GCP service; do not add Cloud
Run, Cloud SQL, or GCS while data still lives on Supabase.

Environments: **local** (Postgres via Homebrew, as set up) and **production**. A staging
environment isn't worth the overhead yet — add one when a bad deploy would actually hurt.

**Connection pooling is mandatory from day one.** Prisma opens a pool per instance, so
scaling to several API containers during a fight-night spike exhausts Postgres connections
long before CPU. Use Supabase's Supavisor. This is the most common way a Prisma app falls
over under load, and retrofitting it mid-outage is miserable.

### Scaling

Traffic here is **spiky, not steadily growing** — low baseline with 50–100× bursts on fight
nights. Levers in order of actual impact:

1. **Edge caching (ISR + CDN)** — dominant. Spikes hit Vercel's edge, collapsing thousands
   of readers into a handful of origin renders.
2. **Connection pooling** — the first thing that breaks.
3. **Read replicas** — rankings and profiles are pure reads.
4. **Horizontal API scaling** — Fastify is stateless, so just more containers.
5. **Vertical DB scaling** — boring, goes further than expected.

| Load | Action |
|---|---|
| Launch → ~10k daily | Default: one API instance, micro DB |
| Fight-night spikes | Tune ISR revalidation; Fly autoscales. DB untouched. |
| ~100k daily | Bump Supabase compute; add a read replica |
| Beyond | Multiple API regions, replica per region |

Design constraints that keep this path open — these matter more than the vendor choice,
because they're what would *block* scaling later:

- Stateless API (JWT only, no in-memory sessions)
- Never store images in Postgres or on container disk
- Watch N+1 queries — an event page fetching fighters in a loop is what melts under spike
- Version the API (`/v1`); mobile clients can't be force-upgraded

CI via GitHub Actions: typecheck, lint, and `prisma migrate deploy` on merge to `main`.
Migrations run as a deploy step, never automatically at app boot.

---

## 12. Security

- All traffic HTTPS; HSTS on the web app
- Zod validation on every request body; Prisma parameterizes all queries
- CORS restricted to known origins — the scaffold currently has `origin: true` (allow all),
  which must be tightened before production
- Rate limiting on login and on public reads
- Secrets in host environment config, never committed — `.env` is gitignored and should stay
  that way
- All mutations audit-logged (actor, entity, field, before/after). Results and rankings are
  the public record of the promotion, and fighters now edit their own data — "who changed
  this" will be asked.

### Personal data

Fighter accounts introduce PII, which raises the bar ([ADR 0003](decisions/0003-fighter-accounts.md)):

- **Private fields live in a separate `FighterProfile` table**, never in the public
  `Fighter` record. A serialization allowlist fails open when someone adds a column;
  separate tables fail closed.
- **Field-level authorization** — a fighter editing their own record must be checked per
  field, not merely "is this your record." Fighters must not be able to write their own
  win/loss record.
- Claim links are credentials: single-use, expiring, revocable.
- **India's DPDP Act** applies to this collection — consent capture, purpose limitation,
  deletion rights. Confirm before collecting ID documents or medical certificates; those
  carry materially higher obligations than a bio.
- Account deletion must preserve fight history (it forms part of *other* fighters' records)
  — anonymise the profile, keep the bouts.

---

## 13. Build order

Each phase should end somewhere shippable.

**Phase 1 — Data foundation**
Schema revisions from §3.2, migration, expanded seed data.

**Phase 2 — API**
Public read endpoints, Zod schemas, shared types wired to `packages/shared`.
*Shippable: real data over HTTP.*

**Phase 3 — Web public site**
Fighter profile, event page, rankings, home, search. SEO metadata.
*Shippable: a public site.*

**Phase 4 — Admin**
Auth, then CRUD for fighters/events/fights, result recording, ranking reorder, image upload.
*Shippable: you can run the site without a developer.*

**Phase 5 — Mobile**
Expo app against the same API.
*Shippable: TestFlight/internal build.*

**Phase 6 — Deploy**
Production hosting, CI, custom domain.

Phases 3 and 5 could run in parallel once the API is stable, but sequential is simpler
solo.

---

## 14. Decisions needed

| # | Decision | Recommendation |
|---|---|---|
| 1 | Fighter record: derived vs denormalized (§3.3) | Derived |
| 2 | Track pre-NMFC records? (§3.3) | Yes — `prior*` columns |
| 3 | Rankings: manual vs computed (§6) | Manual for v1 |
| 4 | Weight classes — do the eight in the schema match NMFC's actual divisions? | Confirm; also whether women's divisions are needed |
| 5 | Is there existing fighter/event data to import? | Affects Phase 1 |

Items 4 and 5 are the ones I can't answer from the code — they're facts about how NMFC
actually operates.

**Settled:** cloud platform, database engine, image storage, and hybrid auth — see
[ADR 0001](decisions/0001-cloud-platform.md) and
[ADR 0004](decisions/0004-hybrid-platform.md).
