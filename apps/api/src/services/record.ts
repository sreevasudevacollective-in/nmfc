/**
 * Fight records are derived, never stored (docs/system-design.md §3.3, option A).
 *
 * The only stored counters are `Fighter.prior*`, which hold a fighter's record from other
 * promotions — history our own Fight table cannot know about. A displayed record is
 * always prior + derived-from-NMFC, which keeps "imported history" and "what we recorded"
 * cleanly separable.
 */

import type { Fight, Fighter } from "@prisma/client";

export interface FightRecord {
  wins: number;
  losses: number;
  draws: number;
  noContests: number;
}

const EMPTY: FightRecord = { wins: 0, losses: 0, draws: 0, noContests: 0 };

type BoutSide = Pick<Fight, "fighterAId" | "fighterBId" | "status" | "outcome">;

/** The fighter's record from NMFC bouts alone. */
export function nmfcRecord(fighterId: string, fights: BoutSide[]): FightRecord {
  const record = { ...EMPTY };

  for (const fight of fights) {
    if (fight.status !== "COMPLETED" || fight.outcome === null) continue;

    const isA = fight.fighterAId === fighterId;
    const isB = fight.fighterBId === fighterId;
    if (!isA && !isB) continue;

    switch (fight.outcome) {
      case "WIN_A":
        if (isA) record.wins += 1;
        else record.losses += 1;
        break;
      case "WIN_B":
        if (isB) record.wins += 1;
        else record.losses += 1;
        break;
      case "DRAW":
        record.draws += 1;
        break;
      case "NO_CONTEST":
        record.noContests += 1;
        break;
    }
  }

  return record;
}

type PriorCounts = Pick<Fighter, "priorWins" | "priorLosses" | "priorDraws">;

/** Prior-promotion record plus NMFC record — what gets displayed. */
export function totalRecord(prior: PriorCounts, nmfc: FightRecord): FightRecord {
  return {
    wins: prior.priorWins + nmfc.wins,
    losses: prior.priorLosses + nmfc.losses,
    draws: prior.priorDraws + nmfc.draws,
    // No-contests are not tracked for prior promotions — there is no `priorNoContests`
    // column, since imported records are conventionally quoted as W-L-D.
    noContests: nmfc.noContests,
  };
}
