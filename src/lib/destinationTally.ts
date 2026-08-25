import { destinations } from "@/data/destinations";
import type { DestinationSlug } from "@/data/types";

export type TallyRow = {
  slug: DestinationSlug;
  name: string;
  /** How many people put this first. */
  firstChoices: number;
  /** Count at each rank: index 0 is 1st, index 1 is 2nd, and so on. */
  placements: number[];
  /** Mean rank across everyone who ranked it, or null if nobody has. */
  averageRank: number | null;
  /** First choices as a share of finished responses, 0–1. */
  share: number;
};

/**
 * Seeded from the destination list rather than from the rankings, so an option
 * nobody put first still appears. "Nobody chose Winter Park" is a finding; a
 * missing row is just confusing.
 *
 * Ranking earns its keep here: a destination nobody puts first but everyone
 * puts second is a real answer, and a single-pick tally couldn't express it.
 * That's why placements and averageRank exist alongside the headline count.
 */
export function tallyDestinations(
  rankings: DestinationSlug[][],
  totalRespondents: number,
): TallyRow[] {
  const rankCount = destinations.length;
  const placements = new Map<DestinationSlug, number[]>(
    destinations.map((d) => [d.slug, Array(rankCount).fill(0)]),
  );

  for (const ranking of rankings) {
    ranking.forEach((slug, index) => {
      // A slug that no longer exists, or a position past the known list, is
      // dropped rather than rendered. The Zod schema should make both
      // impossible; a stale row still shouldn't break the dashboard.
      const counts = placements.get(slug);
      if (counts && index < rankCount) counts[index] += 1;
    });
  }

  return destinations
    .map((destination) => {
      const counts = placements.get(destination.slug) ?? Array(rankCount).fill(0);
      const ranked = counts.reduce((sum, n) => sum + n, 0);
      const rankSum = counts.reduce((sum, n, index) => sum + n * (index + 1), 0);

      return {
        slug: destination.slug,
        name: destination.name,
        firstChoices: counts[0],
        placements: counts,
        averageRank: ranked > 0 ? rankSum / ranked : null,
        share: totalRespondents > 0 ? counts[0] / totalRespondents : 0,
      };
    })
    .sort((a, b) => {
      if (b.firstChoices !== a.firstChoices) return b.firstChoices - a.firstChoices;
      // Level on first choices: the one the group likes better overall wins.
      // A consensus second choice should outrank a polarising one.
      const aRank = a.averageRank ?? Number.POSITIVE_INFINITY;
      const bRank = b.averageRank ?? Number.POSITIVE_INFINITY;
      return aRank - bRank;
    });
}
