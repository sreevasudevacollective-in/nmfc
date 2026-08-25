# ADR 0003 — Fighter accounts and field ownership

**Status:** Accepted (roster path superseded by [ADR 0005](0005-fighter-applications.md))
**Date:** 2026-08-17
**Builds on:** [ADR 0004](0004-hybrid-platform.md)

---

## Context

Fighters get accounts. They sign up, supply personal information, and maintain parts of
their own profile. Separately, **admins add fighters through a web dashboard** — the
promotion owns the roster.

This turns `Fighter` from a passive admin-authored record into a row with two writers, which
creates a problem that has to be solved before any of it is built.

## The core constraint

**A fighter must never be able to edit their own win/loss record.** Nor rankings, fight
results, or opponent history. Those are the promotion's official statements, and their
authority is the entire value of the platform. A self-reported record is not a record.

Therefore "fighters can edit their profile" must mean *specific fields*, and every field
needs an explicit owner.

## Decision

### 1. Roster path — **superseded**

Open signup + application + admin accept: **[ADR 0005](0005-fighter-applications.md)**.
Do not implement claim links. Field ownership below still applies **after** accept.

### 2. Every field has three independent properties

| Axis | Values |
|---|---|
| **Write** | `FIGHTER` · `ADMIN` · `SYSTEM` (derived, nobody types it) |
| **Read** | `PUBLIC` · `FIGHTER+ADMIN` · `ADMIN` |
| **Publish** | immediate · requires review |

These are genuinely independent — a field can be fighter-writable but admin-only readable,
or publicly readable but system-derived.

Indicative classification (final list pending intake forms):

| Field group | Write | Read |
|---|---|---|
| Bio, photo, social links, gym, hometown | FIGHTER | PUBLIC |
| Height, reach | FIGHTER | PUBLIC |
| Name, nickname, weight class | ADMIN | PUBLIC |
| Win/loss/draw record | SYSTEM | PUBLIC |
| Rankings, fight results | ADMIN | PUBLIC |
| Phone, address, emergency contact | FIGHTER | FIGHTER+ADMIN |
| ID documents, medical clearance | FIGHTER | ADMIN |
| Internal notes, disciplinary | ADMIN | ADMIN |

Height and reach are a deliberate judgement call: fighter-writable for convenience, but they
are competitive data that invites embellishment. Revisit if it becomes a problem.

### 3. Private data lives in a separate table, not a filtered column set

Split into a public `Fighter` and a private `FighterProfile` (contact details, documents,
medical).

The alternative — one table with an allowlist at serialization — **fails open**. Someone
adds a column, forgets to update the filter, and it leaks into a public response. Separate
tables **fail closed**: private data cannot appear in a public payload because the public
query never touches that table.

### 4. Fighter edits publish immediately, with an audit log

Not a review queue. The roster is closed and contracted — these are accountable people, not
anonymous accounts, so the abuse risk is low. Review queues also rot when nobody is staffed
to work them, and an unstaffed queue is worse than none: edits silently never go live.

Instead, log every field change with actor and timestamp, and let admins revert. This gives
oversight without blocking the fighter or requiring daily moderation.

Revisit if the roster opens up or grows past the point where admins notice bad edits.

### 5. Model shape

See [ADR 0005](0005-fighter-applications.md). `Fighter` is public roster only; applicants
live on `FighterApplication` until accept.

## Consequences

### Positive
- Official records stay authoritative — fighters cannot touch them
- Private data cannot leak through the public API by omission
- No impersonation vector
- No moderation burden in day-to-day operation

### Negative / to manage
- **Authorization is now field-level, not route-level.** A fighter PATCHing their own
  profile must be checked per field, not just "is this your record." This belongs in the
  service layer with the permission map as data, not scattered `if` statements.
- Two-table split means profile reads/writes touch both — slightly more code.
- Admins must work the application queue or applicants wait (ADR 0005).
- **PII raises the compliance bar.** India's DPDP Act applies to this kind of collection —
  consent capture, purpose limitation, deletion rights. Storing scanned ID documents or
  medical certificates is a materially higher bar than storing a bio and should be
  confirmed as necessary before building it.
- Deleting a fighter account now has to answer: what happens to their fight history? (It
  must survive — it is part of other fighters' records.) Anonymise the profile, keep the
  bouts.

## Open

- **Intake field list** — the forms and collected data are pending. Every field lands in a
  cell of the §2 matrix once they arrive.
- Whether ID documents / medical clearance are actually collected, given the compliance
  cost.
