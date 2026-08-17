import type { WeightClass, DivisionRanking } from "@nmfc/shared";

import { prisma } from "../db/client.js";
import { summarise } from "./fighters.js";

/**
 * Rankings are set manually by admins (§6). Rank uniqueness within a division is a
 * service-layer invariant rather than a database constraint, so that reordering a
 * division is one write instead of a constraint dance (§3.2).
 */
export async function listRankings(weightClass?: WeightClass): Promise<DivisionRanking[]> {
  const rankings = await prisma.ranking.findMany({
    where: weightClass ? { weightClass } : {},
    orderBy: [{ weightClass: "asc" }, { rank: "asc" }],
    include: { fighter: true },
  });

  const summaries = await summarise(rankings.map((r) => r.fighter));

  const byDivision = new Map<WeightClass, DivisionRanking>();

  for (const ranking of rankings) {
    let division = byDivision.get(ranking.weightClass);
    if (!division) {
      division = { weightClass: ranking.weightClass, entries: [] };
      byDivision.set(ranking.weightClass, division);
    }

    division.entries.push({
      rank: ranking.rank,
      fighter: summaries.get(ranking.fighterId)!,
    });
  }

  // A requested division always comes back, empty rather than missing, so clients don't
  // have to distinguish "no such division" from "nobody ranked yet".
  if (weightClass && !byDivision.has(weightClass)) {
    return [{ weightClass, entries: [] }];
  }

  return [...byDivision.values()];
}
