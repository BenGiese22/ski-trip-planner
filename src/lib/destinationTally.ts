import { destinations } from "@/data/destinations";
import type { DestinationSlug } from "@/data/types";

export type TallyRow = {
  slug: DestinationSlug;
  name: string;
  votes: number;
  /** Share of finished responses, 0–1. */
  share: number;
};

/**
 * Seeded from the destination list rather than from the votes, so a
 * destination nobody picked still appears at zero. "Nobody chose Winter Park"
 * is a finding; a Winter Park row silently missing from the table is just
 * confusing.
 *
 * The share denominator is everyone who finished, not everyone who voted.
 * Those are the same number for genuinely submitted responses —
 * `finishProblems()` requires a destination before anyone can finish — but the
 * share should describe the group rather than the subset that answered this
 * particular question.
 */
export function tallyDestinations(
  votes: { destinationSlug: DestinationSlug }[],
  totalRespondents: number,
): TallyRow[] {
  const counts = new Map<DestinationSlug, number>();
  for (const vote of votes) {
    // A vote for a slug that no longer exists is dropped rather than shown.
    // The Zod enum should make this impossible; a stale row still shouldn't
    // be able to break the dashboard.
    if (destinations.some((d) => d.slug === vote.destinationSlug)) {
      counts.set(vote.destinationSlug, (counts.get(vote.destinationSlug) ?? 0) + 1);
    }
  }

  return destinations
    .map((destination) => {
      const count = counts.get(destination.slug) ?? 0;
      return {
        slug: destination.slug,
        name: destination.name,
        votes: count,
        share: totalRespondents > 0 ? count / totalRespondents : 0,
      };
    })
    // Array.prototype.sort is stable, so equal vote counts keep the order
    // destinations are declared in — the table shouldn't reshuffle between
    // renders just because two options are tied.
    .sort((a, b) => b.votes - a.votes);
}
