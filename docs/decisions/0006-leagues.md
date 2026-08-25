# ADR 0006 — Leagues: home and partnered

**Status:** Accepted
**Date:** 2026-08-25
**Amends:** [ADR 0005](0005-fighter-applications.md) — "Leagues (IFL, IPBL, NMFC) stay out
of this slice" no longer holds; see Consequences for what that decision actually costs now.

---

## Context

The schema had no concept of a league or promotion at all — `Event`, `Fight` and `Ranking`
were all implicitly scoped to one single, unnamed promotion. That stopped being tenable once
the roadmap became explicit: NMFC runs three home leagues with different rulesets (No Mercy
Fighting Championship, No Mercy Hand to Hand, No Mercy Slap Wars), and the site should also
list partnered promotions elsewhere in India.

Two things this broke concretely: an "Upcoming Fights" listing couldn't say which league a
card belonged to, and `Ranking`'s `(weightClass, rank)` uniqueness meant only one global #1
lightweight could exist across all three leagues at once — a Slap Wars #1 and an MMA #1
couldn't coexist.

Four scope questions were resolved by explicit choice rather than default, each picking the
lighter-weight option to avoid building infrastructure nothing asks for yet:

| Question | Decision |
|---|---|
| Sponsor Opportunities page | Informational content + a contact-form submission. No sponsor CRM, no tier tracking. |
| Apparel & Merchandise | A display catalog, admin-managed. No cart, checkout, or payment integration — purchasing stays off-site. |
| Founding Team page | Static content in the page itself. No database table; team composition changes rarely enough that a code change is fine. |
| Partnered leagues | A directory entry only — name, description, link out. NMFC does not track their fighters, events, or results. |

## Decision

```
League            HOME (own events/rankings/roster) | PARTNERED (directory entry only)
FighterLeague     many-to-many join: a fighter can compete in more than one home league
Event.leagueId    required — every event belongs to exactly one league
Ranking.leagueId  required — uniqueness moves to (leagueId, weightClass, rank)
```

**Fighter ↔ League is many-to-many**, not a single foreign key. A crossover fighter — one
competing in both No Mercy Fighting Championship and No Mercy Slap Wars — gets one `Fighter`
row with two `FighterLeague` rows, not two separate profiles.

**`Ranking` uniqueness changes** from global `(weightClass, rank)` to `(leagueId, weightClass,
rank)`. This is not additive — it changes what uniqueness means. Before, only one #1
lightweight could exist site-wide; now each league keeps an independent ranking table.

**`WeightClass` stays a single global enum**, not a per-league taxonomy. It was already
nullable on `Fighter` and `Fight`, so a Slap Wars bout that doesn't use weight classes simply
leaves it null. A full per-league weight-class model (different divisions per discipline)
would be a substantially bigger schema change for a distinction nothing needs yet.

`SponsorInquiry` and `Product` are new, deliberately thin models matching the table above —
a contact-form submission and a display-only catalog entry, respectively. Neither has any
workflow state beyond "it exists."

## Consequences

### Positive
- Rankings, events, and rosters are now correctly scoped per promotion
- A crossover fighter needs no duplicate profile
- Partnered leagues can be listed without building anything to track their data

### Negative / to manage
- **The fighter application form doesn't ask which league an applicant is trying out for.**
  `acceptApplication` defaults every accepted fighter onto the flagship league (No Mercy
  Fighting Championship). A Hand to Hand or Slap Wars applicant is accepted into the wrong
  league and needs manual `FighterLeague` reassignment after acceptance. This is the
  concrete cost of not revisiting ADR 0005's intake flow yet — see Revisit below.
- No per-league weight-class taxonomy. If Slap Wars or Hand to Hand need their own divisions
  (not just "no divisions"), this becomes a real schema change, not a config tweak.
- Sponsor inquiries and merchandise have no operational workflow — an admin monitors the
  `SponsorInquiry` table and the `Product` catalog by hand. Fine at current volume; revisit
  if either grows past what one person can track manually.

## Revisit if

- The application form should collect a league choice at intake — this is the direct fix for
  the "Negative" item above, and is the natural next step now that `League` exists.
- A home league needs its own weight-class list distinct from the MMA-style eight already
  in `WeightClass`.
- Sponsor inquiries or merchandise need real workflow (tier tracking, checkout) rather than
  a table someone reads.
