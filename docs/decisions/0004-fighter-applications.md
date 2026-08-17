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

### 7. Under-18 applications are blocked at intake

Not merely an eligibility rule. Under the DPDP Act a minor's personal data requires
verifiable parental consent, so accepting one under-18 application would pull NMFC into a
materially different compliance regime for the sake of an applicant who cannot compete
anyway. Blocked on date of birth before the form is accepted.

Age is computed, never stored (§3). The boundary is tested: the day of an applicant's
eighteenth birthday passes, the day before does not.

### 8. Locked on submission; only an admin edits after that

An applicant may edit freely while the application is a `DRAFT`. On submission it locks —
reviewers cannot assess a moving target. After that only an admin may edit, and every such
edit is audit-logged.

An applicant may still **withdraw** before a decision. Withdrawing does not reopen the
application for editing; it closes it.

### 9. Three outcomes, not two

"Not selected" is two different things, and collapsing them makes the talent pipeline
useless:

| Outcome | Meaning | Retention |
|---|---|---|
| `ACCEPTED` | Onto the roster; `Fighter` created | Becomes a fighter record |
| `DEFERRED` | Not now, worth revisiting — the pipeline | Retained deliberately, with feedback |
| `REJECTED` | Declined, not to be pursued | Minimal retention |

Without the split, a pipeline query returns everyone who was ever turned down — including
applicants refused for cause, such as a falsified record or an active suspension. Those are
people NMFC would never invite back, and they must not appear in a "who should we look at
again" list.

`DEFERRED` carries two supporting fields: `developmentFeedback`, which is shown **to** the
applicant so they know what to work on, and `revisitAfter`, which puts them back on the
review queue at the right time. `developmentFeedback` is deliberately separate from
`reviewNotes` — internal assessment must never leak into an applicant-facing view.

### 10. Retention is a stated purpose, not indefinite storage

Non-accepted applications are kept so applicants can be developed and reconsidered. That is
a legitimate purpose, and it is what makes the retention defensible — but it has to be
*stated*, bounded, and minimised, or it is just indefinite storage of other people's
personal data.

Two distinct events, hence two timestamps:

- **`minimisedAt`** — the fields the pipeline does not need are purged: emergency contact,
  address, medical declarations. Those were collected so someone could safely *compete*; for
  an applicant who is not competing, that purpose has lapsed. What survives is
  scouting-relevant: name, contact, discipline, weight class, experience, attributes, coach,
  video links, reviewer assessment.
- **`retainUntil`** — end of the retention window, after which the record is deleted or
  anonymised.

The **purpose must be disclosed on the form** at consent time — an applicant has to know
their application may be kept for future consideration. Without that notice the retention
has no basis.

### 11. Applicants are users

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

- **Retention window length.** The mechanism exists (`minimisedAt`, `retainUntil`); the
  numbers do not. How many months is a `DEFERRED` application held before deletion, and does
  a `REJECTED` one get a shorter window? Needed before intake goes live.
- **Which fields survive minimisation.** The list above is a proposal, not a decision.
- **Coach verification (§9).** Currently fields the *applicant* fills in, plus a flag. That
  is self-attestation wearing the coach's name — it carries no independent weight. Real
  verification means emailing the coach a token to confirm the record themselves, which is a
  materially larger feature and is not built. If a coach's confirmation is meant to be
  evidence, this does not provide it.
- **First admin account.** How the initial `ADMIN` user is created is undefined — a seed
  script, or a manual role promotion. Deferred by decision, but it blocks Phase 4.
- **Consent capture.** The §10 declarations are stored with a timestamp. Whether a versioned
  terms document must be retained alongside them is a DPDP question. The retention purpose
  (§10 above) must appear in that notice.
- Whether accepted applicants' video links should be archived before they rot.

## Decision log

| Question | Answer |
|---|---|
| Block under-18 applications? | Yes, hard block at intake |
| Editable after submission? | No — locked; admin edits only, audit-logged |
| Retain non-accepted applications? | Yes, as a talent pipeline with development feedback |
| How is the first admin created? | Deferred |
