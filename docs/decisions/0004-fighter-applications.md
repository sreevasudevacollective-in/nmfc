# ADR 0004 — Fighter applications and open intake

**Status:** Accepted
**Date:** 2026-08-17
**Amends:** [ADR 0003 — Fighter accounts](0003-fighter-accounts.md) §1

---

## Context

The NMFC Standard Fighter Eligibility Form is an **open application**: anyone may apply,
NMFC reviews, and "passing the application does not guarantee selection." Applicants get
accounts so they can track status and edit before review.

This directly contradicts ADR 0003 §1, which closed the roster:

> Admins create fighter records in the dashboard. The system issues a one-time claim link
> to the fighter... Impersonation is structurally impossible because the promotion controls
> who is invited. The alternative — open self-registration with approval after the fact —
> creates a moderation queue and a window in which fake profiles are live.

The moderation-queue objection was correct and still applies. The live-fake-profiles
objection is the one that has to be engineered away.

## Decision

### 1. An Application is not a Fighter

Two separate entities, and this is the whole design:

```
Applicant signs up  →  Application (DRAFT → SUBMITTED)
                         ↓ admin review
                       ACCEPTED  →  Fighter created, bound to the existing account
                       REJECTED  →  no Fighter row ever exists
```

**`Application` has no public endpoint at all.** Not a filtered one — none. So an unreviewed
or rejected applicant cannot appear anywhere on the public site, and ADR 0003's guarantee
survives intact: the public roster is still admin-controlled, because only an admin's
acceptance mints a `Fighter`.

The ADR 0003 path is unchanged and still supported: an admin may create a `Fighter`
directly and issue a claim link, without any application. `Fighter.applicationId` is
nullable precisely because of this.

### 2. Self-reported records never become official records

§4 of the form collects wins, losses, draws, KO/TKO counts, amateur and professional
records. **None of it may touch `Fighter.prior*` automatically.**

ADR 0003's core constraint is that a fighter cannot edit their own record. An application
is a fighter typing their own record, so every one of those fields is stored as
`claimed*` on the `Application` and is understood as an assertion, not a fact. On
acceptance an admin transcribes whatever they have verified into `Fighter.prior*` as a
deliberate, audited act.

This is why the §3.3 split — `prior*` stored, NMFC record derived — pays off here: imported
history has a home that is visibly separate from anything NMFC recorded itself.

### 3. Derived values are not stored

Consistent with §3.3:

- **Age** is derived from date of birth. Storing it guarantees it goes stale.
- **Total fights** is `wins + losses + draws`.
- **Minimum-gate eligibility** is computed from the answers, not stored as a flag.

The form's gate — 18+, three years' structured training, no active suspension, willing to
comply — is mechanically checkable. "Active fighter" and "verifiable experience" are
judgement calls and stay with the reviewer.

### 4. Repeated fields are collapsed

Height and reach appear in §2 and §6. Weight class appears in §2, §6 and §11. Coach contact
appears in §2 and §9. Each is stored once. A form may reasonably ask twice; a schema must
not answer twice.

### 5. Structure over columns

- **Discipline experience** (§3) is a child table keyed by discipline, not eight columns.
  Adding a discipline becomes data, not a migration.
- **Videos** (§8) are a child table — "1–3 complete fights" is a list.
- **Attributes** (§7) are an enum array; it is a fixed 14-item checklist with no per-item data.

### 6. Video is links, not uploads

Applicants submit URLs. NMFC stores no footage at application stage — no transcoding, no
gigabytes per applicant, and no retention problem for rejected applicants' video. The
trade is that links rot or go private; reviewers should capture what matters during review.

### 7. Applicants are users

`Role` gains `APPLICANT`. An applicant holds an account before any `Fighter` exists, so
`User` is no longer one-to-one with `Fighter` in practice — it is one-to-optional, exactly
as ADR 0003 modelled it, but now populated from the other direction.

Re-application is permitted: `User` has many `Application`s. Only one may be open at a
time, which is a service invariant rather than a constraint.

## Consequences

### Positive
- Public roster integrity is unchanged — no unreviewed profile is ever reachable
- Self-reported records are structurally quarantined from official ones
- The admin-created/claimed path from ADR 0003 still works, unmodified
- Reviewers get a queue of applications rather than a queue of live profiles to police

### Negative / to manage

- **The moderation queue ADR 0003 warned about now exists.** It was avoided by closing the
  roster; open intake brings it back. An unstaffed queue means applicants wait indefinitely
  with no signal. Someone must own it, and applicants should see status.
- **PII exposure rises sharply.** ADR 0003 assumed a small contracted roster. This collects
  phone numbers, addresses, emergency contacts, coach contacts and medical declarations
  from everyone who applies — including everyone rejected. Under India's DPDP Act that is
  purpose-limited data with deletion obligations. **A retention policy is now required, not
  optional** — see Open.
- `Application` is a wide model because the form is long. It is tolerable because it is a
  single-purpose record that is written once and read by reviewers.
- Applicant accounts widen the auth surface: every applicant is an account, and the
  provider decision (ADR 0002) now gates more than admin login.

## Open

- **Retention.** How long is a rejected application kept, and what is deleted versus
  anonymised? Nothing is built here yet; it needs a decision before the form goes live.
- **Coach verification (§9).** Currently modelled as fields the *applicant* fills in, plus a
  flag. A real coach-side verification — emailing the coach a token to confirm the record
  independently — is a materially larger feature and is not built. If a coach's confirmation
  is meant to carry evidential weight, self-entry does not provide it.
- **Consent capture.** The §10 declarations are stored with a timestamp. Whether a versioned
  terms document must be retained alongside them is a DPDP question.
- Whether accepted applicants' video links should be archived before they rot.
