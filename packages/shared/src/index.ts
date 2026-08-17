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
