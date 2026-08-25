import type { Metadata } from "next";
import { AdminLoginForm } from "@/components/AdminLoginForm";
import { AdminLogoutButton } from "@/components/AdminLogoutButton";
import { isAdminAuthenticated } from "@/lib/adminServerSession";

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

/**
 * Placeholder for step 3. The heatmap, tally and cost rollup land in steps
 * 4-7; this exists so the gate itself is testable end to end first.
 */
function AdminDashboard() {
  return (
    <p className="text-sm text-ink-soft" data-testid="admin-dashboard">
      Signed in. The heatmap, destination tally and cost rollup land here next.
    </p>
  );
}
