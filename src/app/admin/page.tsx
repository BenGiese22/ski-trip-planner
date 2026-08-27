import type { Metadata } from "next";
import { AdminCostRollup } from "@/components/AdminCostRollup";
import { AdminDestinationTally } from "@/components/AdminDestinationTally";
import { AdminHeatmap } from "@/components/AdminHeatmap";
import { AdminLoginForm } from "@/components/AdminLoginForm";
import { AdminLogoutButton } from "@/components/AdminLogoutButton";
import {
  availabilityCountsByDate,
  countSubmittedRespondents,
  listSubmittedDestinationRankings,
  listSubmittedRespondentsWithTopChoice,
} from "@/db/queries";
import { isAdminAuthenticated } from "@/lib/adminServerSession";
import { buildCostRollup } from "@/lib/adminCostRollup";
import { buildHeatmap } from "@/lib/availabilityHeatmap";
import { tallyDestinations } from "@/lib/destinationTally";

export const metadata: Metadata = {
  title: "Responses — Colorado ski trip planner",
  // Not that a passcode-gated page is likely to be crawled, but there's no
  // reason for it to appear in a search result either.
  robots: { index: false, follow: false },
};

/**
 * The host's view (PLAN.md §3). Gated by a shared passcode rather than a real
 * auth system (§6), and by a passcode rather than Vercel's Deployment
 * Protection (§17 decision 1) so the Playwright suite can actually exercise it.
 *
 * The gate is checked *before* any database work. An unauthenticated request
 * costs one HMAC verification and nothing more — which is the security
 * property worth stating, rather than merely "the route is gated".
 */
export default async function AdminPage() {
  const authenticated = await isAdminAuthenticated();

  return (
    <main className="max-w-[980px] mx-auto px-6 py-14">
      <div className="flex items-baseline justify-between gap-4 flex-wrap mb-1.5">
        <h1 className="text-2xl">Responses</h1>
        {authenticated && <AdminLogoutButton />}
      </div>

      {authenticated ? (
        <AdminDashboard />
      ) : (
        <>
          <p className="text-sm text-ink-soft max-w-[60ch] mb-5">
            This page shows what everyone has said so far. It&rsquo;s just for
            Ben — enter the passcode to see it.
          </p>
          <AdminLoginForm />
        </>
      )}
    </main>
  );
}

async function AdminDashboard() {
  const [totalRespondents, counts, rankings, costEntries] = await Promise.all([
    countSubmittedRespondents(),
    availabilityCountsByDate(),
    listSubmittedDestinationRankings(),
    listSubmittedRespondentsWithTopChoice(),
  ]);

  return (
    <div data-testid="admin-dashboard">
      <p className="text-sm text-ink-soft mb-6">
        <strong className="text-ink font-mono">{totalRespondents}</strong>{" "}
        {totalRespondents === 1 ? "person has" : "people have"} finished their
        response.
      </p>

      <section className="mb-10">
        <h2 className="text-xl mb-1.5">When the group can go</h2>
        <p className="text-sm text-ink-soft max-w-[60ch] mb-4">
          The darker the day, the more of the group it works for.
        </p>
        {totalRespondents === 0 ? (
          <p className="text-sm text-ink-soft border border-line rounded-lg p-4">
            Nothing to show yet — the heatmap fills in as people finish their
            responses.
          </p>
        ) : (
          <AdminHeatmap
            grids={buildHeatmap(counts, totalRespondents)}
            totalRespondents={totalRespondents}
          />
        )}
      </section>

      <section className="mb-10">
        <h2 className="text-xl mb-1.5">Where they&rsquo;d rather go</h2>
        <p className="text-sm text-ink-soft max-w-[60ch] mb-4">
          Ranked best-first by each person. Every option is listed, including any nobody put first.
        </p>
        {totalRespondents === 0 ? (
          <p className="text-sm text-ink-soft border border-line rounded-lg p-4">
            No preferences yet.
          </p>
        ) : (
          <AdminDestinationTally rows={tallyDestinations(rankings, totalRespondents)} />
        )}
      </section>

      <section className="mb-10">
        <h2 className="text-xl mb-1.5">What it adds up to</h2>
        <p className="text-sm text-ink-soft max-w-[60ch] mb-4">
          Per person, and for the group. Planning estimates, not quotes.
        </p>
        {totalRespondents === 0 ? (
          <p className="text-sm text-ink-soft border border-line rounded-lg p-4">
            No costs to add up yet — this fills in as people finish their
            responses.
          </p>
        ) : (
          <AdminCostRollup rollup={buildCostRollup(costEntries)} />
        )}
      </section>
    </div>
  );
}
