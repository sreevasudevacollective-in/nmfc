/**
 * Shared contract between the API, web, and mobile.
 *
 * Zod schemas are the single definition (docs/system-design.md §4): the API validates
 * against them and clients infer their types from them, so a response shape cannot drift
 * from the type that describes it. Hand-written interfaces duplicating the Prisma schema
 * are exactly what this replaces.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Enums — mirror prisma/schema.prisma
// ---------------------------------------------------------------------------

export const weightClassSchema = z.enum([
  "FLYWEIGHT",
  "BANTAMWEIGHT",
  "FEATHERWEIGHT",
  "LIGHTWEIGHT",
  "WELTERWEIGHT",
  "MIDDLEWEIGHT",
  "LIGHT_HEAVYWEIGHT",
  "HEAVYWEIGHT",
]);
export type WeightClass = z.infer<typeof weightClassSchema>;

export const eventStatusSchema = z.enum(["SCHEDULED", "COMPLETED", "CANCELLED"]);
export type EventStatus = z.infer<typeof eventStatusSchema>;

export const fightStatusSchema = z.enum(["SCHEDULED", "COMPLETED", "CANCELLED"]);
export type FightStatus = z.infer<typeof fightStatusSchema>;

export const fightOutcomeSchema = z.enum(["WIN_A", "WIN_B", "DRAW", "NO_CONTEST"]);
export type FightOutcome = z.infer<typeof fightOutcomeSchema>;

export const claimStatusSchema = z.enum(["UNCLAIMED", "INVITED", "CLAIMED"]);
export type ClaimStatus = z.infer<typeof claimStatusSchema>;

export const roleSchema = z.enum(["ADMIN", "FIGHTER"]);
export type Role = z.infer<typeof roleSchema>;

/** Display labels — the API returns enum values, never prose. */
export const WEIGHT_CLASS_LABELS: Record<WeightClass, string> = {
  FLYWEIGHT: "Flyweight",
  BANTAMWEIGHT: "Bantamweight",
  FEATHERWEIGHT: "Featherweight",
  LIGHTWEIGHT: "Lightweight",
  WELTERWEIGHT: "Welterweight",
  MIDDLEWEIGHT: "Middleweight",
  LIGHT_HEAVYWEIGHT: "Light Heavyweight",
  HEAVYWEIGHT: "Heavyweight",
};

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------

export const recordSchema = z.object({
  wins: z.number().int(),
  losses: z.number().int(),
  draws: z.number().int(),
  noContests: z.number().int(),
});
export type FightRecord = z.infer<typeof recordSchema>;

/** Conventional "8-2-1" / "8-2-1 (1 NC)" rendering. */
export function formatRecord(record: FightRecord): string {
  const base = `${record.wins}-${record.losses}-${record.draws}`;
  return record.noContests > 0 ? `${base} (${record.noContests} NC)` : base;
}

// ---------------------------------------------------------------------------
// Fighter
// ---------------------------------------------------------------------------

/** Shape used in lists and when embedded as a bout participant. */
export const fighterSummarySchema = z.object({
  id: z.string(),
  slug: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  nickname: z.string().nullable(),
  weightClass: weightClassSchema.nullable(),
  photoKey: z.string().nullable(),
  record: recordSchema,
});
export type FighterSummary = z.infer<typeof fighterSummarySchema>;

/** One bout as it appears on a fighter's profile. */
export const fighterFightSchema = z.object({
  id: z.string(),
  status: fightStatusSchema,
  /** Result from this fighter's perspective; null while the bout is unfought. */
  result: z.enum(["WIN", "LOSS", "DRAW", "NO_CONTEST"]).nullable(),
  opponent: fighterSummarySchema,
  weightClass: weightClassSchema.nullable(),
  isTitleFight: z.boolean(),
  method: z.string().nullable(),
  round: z.number().int().nullable(),
  time: z.string().nullable(),
  event: z.object({
    id: z.string(),
    slug: z.string(),
    name: z.string(),
    date: z.string(),
  }),
});
export type FighterFight = z.infer<typeof fighterFightSchema>;

export const fighterDetailSchema = fighterSummarySchema.extend({
  dob: z.string().nullable(),
  heightCm: z.number().int().nullable(),
  reachCm: z.number().int().nullable(),
  gym: z.string().nullable(),
  hometown: z.string().nullable(),
  bio: z.string().nullable(),
  instagramUrl: z.string().nullable(),
  facebookUrl: z.string().nullable(),
  xUrl: z.string().nullable(),
  /** Record from NMFC bouts alone; `record` is this plus the pre-NMFC record. */
  nmfcRecord: recordSchema,
  fights: z.array(fighterFightSchema),
});
export type FighterDetail = z.infer<typeof fighterDetailSchema>;

// ---------------------------------------------------------------------------
// Event
// ---------------------------------------------------------------------------

export const eventSummarySchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  date: z.string(),
  venue: z.string().nullable(),
  status: eventStatusSchema,
  posterKey: z.string().nullable(),
  fightCount: z.number().int(),
});
export type EventSummary = z.infer<typeof eventSummarySchema>;

/** One bout as it appears on an event card — neutral A/B, not one fighter's view. */
export const boutSchema = z.object({
  id: z.string(),
  boutOrder: z.number().int(),
  isTitleFight: z.boolean(),
  weightClass: weightClassSchema.nullable(),
  status: fightStatusSchema,
  outcome: fightOutcomeSchema.nullable(),
  method: z.string().nullable(),
  round: z.number().int().nullable(),
  time: z.string().nullable(),
  fighterA: fighterSummarySchema,
  fighterB: fighterSummarySchema,
});
export type Bout = z.infer<typeof boutSchema>;

export const eventDetailSchema = eventSummarySchema.extend({
  /** Main event first — highest boutOrder leads the card. */
  bouts: z.array(boutSchema),
});
export type EventDetail = z.infer<typeof eventDetailSchema>;

// ---------------------------------------------------------------------------
// Rankings
// ---------------------------------------------------------------------------

export const rankingEntrySchema = z.object({
  rank: z.number().int(),
  fighter: fighterSummarySchema,
});
export type RankingEntry = z.infer<typeof rankingEntrySchema>;

export const divisionRankingSchema = z.object({
  weightClass: weightClassSchema,
  entries: z.array(rankingEntrySchema),
});
export type DivisionRanking = z.infer<typeof divisionRankingSchema>;

// ---------------------------------------------------------------------------
// Envelopes
// ---------------------------------------------------------------------------

export interface Paginated<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
}

export function paginatedSchema<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    data: z.array(item),
    page: z.number().int(),
    limit: z.number().int(),
    total: z.number().int(),
  });
}

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ApiError = z.infer<typeof apiErrorSchema>;

// ---------------------------------------------------------------------------
// Request query schemas
// ---------------------------------------------------------------------------

export const MAX_PAGE_SIZE = 100;

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(20),
});

export const fighterListQuerySchema = paginationQuerySchema.extend({
  weightClass: weightClassSchema.optional(),
  /** Free-text match against first name, last name, and nickname. */
  q: z.string().trim().min(1).max(100).optional(),
});
export type FighterListQuery = z.infer<typeof fighterListQuerySchema>;

export const eventListQuerySchema = paginationQuerySchema.extend({
  status: eventStatusSchema.optional(),
});
export type EventListQuery = z.infer<typeof eventListQuerySchema>;

// ---------------------------------------------------------------------------
// Applications — see docs/decisions/0004-fighter-applications.md
// ---------------------------------------------------------------------------

export const genderSchema = z.enum(["MALE", "FEMALE", "OTHER"]);
export type Gender = z.infer<typeof genderSchema>;

export const stanceSchema = z.enum(["ORTHODOX", "SOUTHPAW", "SWITCH"]);
export type Stance = z.infer<typeof stanceSchema>;

export const disciplineSchema = z.enum([
  "BOXING", "MUAY_THAI", "KICKBOXING", "SANDA", "KARATE",
  "TAEKWONDO", "MMA", "BJJ", "WRESTLING", "OTHER",
]);
export type Discipline = z.infer<typeof disciplineSchema>;

export const conditioningLevelSchema = z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED", "ELITE"]);
export type ConditioningLevel = z.infer<typeof conditioningLevelSchema>;

export const fightAttributeSchema = z.enum([
  "PUNCHING_POWER", "HAND_SPEED", "KICKING_POWER", "KICKING_SPEED", "FOOTWORK",
  "COUNTER_STRIKING", "COMBINATION_STRIKING", "DEFENCE", "FIGHT_IQ", "CARDIO",
  "DURABILITY", "EXPLOSIVENESS", "PRESSURE_FIGHTING", "TECHNICAL_STRIKING",
]);
export type FightAttribute = z.infer<typeof fightAttributeSchema>;

export const videoKindSchema = z.enum([
  "FULL_FIGHT", "HIGHLIGHT", "PAD_WORK", "HEAVY_BAG", "SHADOWBOXING",
]);
export type VideoKind = z.infer<typeof videoKindSchema>;

export const applicationStatusSchema = z.enum([
  "DRAFT", "SUBMITTED", "UNDER_REVIEW", "SHORTLISTED",
  "ACCEPTED", "DEFERRED", "REJECTED", "WITHDRAWN",
]);
export type ApplicationStatus = z.infer<typeof applicationStatusSchema>;

// --- Eligibility rules -----------------------------------------------------

/**
 * Hard minimum age. Not merely an eligibility rule: under India's DPDP Act a minor's
 * data requires verifiable parental consent, so accepting an under-18 application would
 * pull NMFC into a materially different compliance regime. Blocked at intake.
 */
export const MINIMUM_AGE = 18;

/** Minimum years of structured training the intake gate expects. */
export const MINIMUM_YEARS_EXPERIENCE = 3;

/** Whole years completed between two dates. */
export function ageOn(dob: Date, on: Date): number {
  let age = on.getUTCFullYear() - dob.getUTCFullYear();
  const monthDelta = on.getUTCMonth() - dob.getUTCMonth();

  if (monthDelta < 0 || (monthDelta === 0 && on.getUTCDate() < dob.getUTCDate())) {
    age -= 1;
  }

  return age;
}

export function meetsMinimumAge(dob: Date, on: Date = new Date()): boolean {
  return ageOn(dob, on) >= MINIMUM_AGE;
}

/**
 * The form's minimum eligibility gate, computed rather than stored.
 *
 * Only the mechanically checkable parts live here. "Active fighter" and "verifiable
 * combat-sports experience" are reviewer judgement and deliberately absent — a gate that
 * pretends to decide them would be lying about what it checked.
 */
export interface GateInput {
  dob: Date;
  yearsExperience: number;
  underSuspension: boolean;
  contractualRestriction: boolean;
  willingComplyRules: boolean;
  willingMedicalScreening: boolean;
}

export interface GateResult {
  /** False only for the blocking failures — age and active suspension. */
  eligible: boolean;
  /** Machine-readable reasons, for both UI messaging and reviewer triage. */
  failures: string[];
  /** Non-blocking concerns a reviewer should see. */
  warnings: string[];
}

export function evaluateMinimumGate(input: GateInput, on: Date = new Date()): GateResult {
  const failures: string[] = [];
  const warnings: string[] = [];

  // Blocking.
  if (!meetsMinimumAge(input.dob, on)) failures.push("UNDER_MINIMUM_AGE");
  if (input.underSuspension) failures.push("ACTIVE_SUSPENSION");

  // Non-blocking: recorded, surfaced to the reviewer, but not an automatic refusal.
  // A hard block here would discard near-misses NMFC may want in the pipeline.
  if (input.yearsExperience < MINIMUM_YEARS_EXPERIENCE) warnings.push("BELOW_MINIMUM_EXPERIENCE");
  if (input.contractualRestriction) warnings.push("CONTRACTUAL_RESTRICTION");
  if (!input.willingComplyRules) warnings.push("UNWILLING_TO_COMPLY");
  if (!input.willingMedicalScreening) warnings.push("UNWILLING_MEDICAL_SCREENING");

  return { eligible: failures.length === 0, failures, warnings };
}

// --- Edit permissions ------------------------------------------------------

/**
 * An applicant may edit only while the application is a draft. It locks on submission;
 * after that an admin edits on their behalf and the change is audit-logged. Reviewers
 * cannot assess a moving target.
 */
export function isApplicantEditable(status: ApplicationStatus): boolean {
  return status === "DRAFT";
}

/** An applicant may pull out any time before a decision, but cannot reopen for editing. */
export function isApplicantWithdrawable(status: ApplicationStatus): boolean {
  return status === "SUBMITTED" || status === "UNDER_REVIEW" || status === "SHORTLISTED";
}

/** Outcomes retained as a talent pipeline rather than closed out. */
export function isPipelineStatus(status: ApplicationStatus): boolean {
  return status === "DEFERRED";
}

// --- Submission payload ----------------------------------------------------

const optionalUrl = z.string().trim().url().max(500).optional();
const requiredText = (max: number) => z.string().trim().min(1).max(max);

/**
 * The eligibility form payload. Mirrors the form's sections, but stores each fact once —
 * the form asks for height, reach, weight class and coach contact more than once.
 *
 * Age and total fights are absent by design: both are derived (ADR 0004 §3).
 */
export const applicationInputSchema = z
  .object({
    // §1 Personal information
    firstName: requiredText(80),
    lastName: requiredText(80),
    dob: z.coerce.date(),
    gender: genderSchema,
    nationality: requiredText(80),
    city: requiredText(120),
    state: z.string().trim().max(120).optional(),
    country: requiredText(80),
    phone: requiredText(30),
    email: z.string().trim().email().max(255),
    instagramUrl: optionalUrl,
    facebookUrl: optionalUrl,
    xUrl: optionalUrl,
    emergencyName: requiredText(160),
    emergencyPhone: requiredText(30),
    emergencyRelation: z.string().trim().max(80).optional(),

    // §2 + §6 Fighter profile and physicals
    nickname: z.string().trim().max(80).optional(),
    primaryStyle: disciplineSchema,
    secondaryStyle: disciplineSchema.optional(),
    desiredWeightClass: weightClassSchema,
    heightCm: z.number().int().min(120).max(250),
    reachCm: z.number().int().min(120).max(260),
    walkingWeightKg: z.number().min(30).max(250),
    competitionWeightKg: z.number().min(30).max(250),
    legLengthCm: z.number().int().min(40).max(140).optional(),
    stance: stanceSchema,
    yearsExperience: z.number().int().min(0).max(60),
    trainingDaysPerWeek: z.number().int().min(1).max(7),
    conditioning: conditioningLevelSchema,
    gym: requiredText(160),
    headCoach: requiredText(160),
    coachPhone: z.string().trim().max(30).optional(),
    coachEmail: z.string().trim().email().max(255).optional(),

    // §3 Combat-sports background
    experience: z
      .array(
        z.object({
          discipline: disciplineSchema,
          years: z.number().int().min(0).max(60),
          record: z.string().trim().max(120).optional(),
          notes: z.string().trim().max(1000).optional(),
        }),
      )
      .max(10)
      .default([]),

    // §4 Competition record — self-reported, never official
    claimedWins: z.number().int().min(0).max(500).default(0),
    claimedLosses: z.number().int().min(0).max(500).default(0),
    claimedDraws: z.number().int().min(0).max(500).default(0),
    claimedKoWins: z.number().int().min(0).max(500).default(0),
    claimedDecisionWins: z.number().int().min(0).max(500).default(0),
    claimedSubmissionWins: z.number().int().min(0).max(500).default(0),
    claimedAmateurRecord: z.string().trim().max(120).optional(),
    claimedProRecord: z.string().trim().max(120).optional(),
    lastFightDate: z.coerce.date().optional(),
    nextFightDate: z.coerce.date().optional(),
    honours: z.string().trim().max(2000).optional(),
    currentPromotion: z.string().trim().max(160).optional(),

    // §5 Eligibility
    medicallyCleared: z.boolean(),
    underSuspension: z.boolean(),
    contractualRestriction: z.boolean(),
    willingMedicalScreening: z.boolean(),
    willingScouting: z.boolean(),
    willingSparringEvaluation: z.boolean(),
    willingComplyRules: z.boolean(),
    willingAccurateRecords: z.boolean(),

    // §7 Attributes
    attributes: z.array(fightAttributeSchema).max(14).default([]),

    // §8 Video — links only, no uploads
    videos: z
      .array(
        z.object({
          kind: videoKindSchema,
          url: z.string().trim().url().max(500),
          label: z.string().trim().max(160).optional(),
        }),
      )
      .max(20)
      .default([]),

    // §9 Coach verification — applicant-entered, not independently verified
    coachYearsWithFighter: z.number().int().min(0).max(60).optional(),
    coachAssessment: z.string().trim().max(4000).optional(),
    coachVerifiedRecord: z.boolean().default(false),

    // §10 Declarations — all four required to submit
    declaredAccurate: z.literal(true),
    ackIndependentMedical: z.literal(true),
    ackNoGuarantee: z.literal(true),
    agreedSafetyRules: z.literal(true),

    // §11 Fighter declaration
    motivation: z.string().trim().max(4000).optional(),
    careerGoals: z.string().trim().max(4000).optional(),
    differentiator: z.string().trim().max(4000).optional(),
    influence: z.string().trim().max(500).optional(),
    willingToRelocate: z.boolean().default(false),
  })
  .refine((v) => meetsMinimumAge(v.dob), {
    path: ["dob"],
    message: `Applicants must be at least ${MINIMUM_AGE} years old.`,
  })
  .refine((v) => !v.underSuspension, {
    path: ["underSuspension"],
    message: "Fighters under suspension by an athletic commission cannot apply.",
  })
  .refine(
    (v) => v.claimedKoWins + v.claimedDecisionWins + v.claimedSubmissionWins <= v.claimedWins,
    {
      path: ["claimedWins"],
      message: "Wins by method cannot exceed total wins.",
    },
  )
  .refine((v) => v.secondaryStyle !== v.primaryStyle, {
    path: ["secondaryStyle"],
    message: "Secondary style must differ from primary style.",
  });

export type ApplicationInput = z.infer<typeof applicationInputSchema>;
