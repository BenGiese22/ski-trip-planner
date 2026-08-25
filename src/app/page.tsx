import { AvailabilityGrid } from "@/components/AvailabilityGrid";
import { CostSection } from "@/components/CostSection";
import { DestinationRanker } from "@/components/DestinationRanker";
import { FlightCards } from "@/components/FlightCards";
import { Footer } from "@/components/Footer";
import { Hero } from "@/components/Hero";
import { IntakeForm } from "@/components/IntakeForm";
import { ResponseProvider } from "@/components/ResponseProvider";
import { SaveBar } from "@/components/SaveBar";
import { Section } from "@/components/Section";
import { SourceLine } from "@/components/SourceLine";
import { WelcomeBack } from "@/components/WelcomeBack";
import { passInfo, passSources } from "@/data/passInfo";
import { currentRespondent, loadClientResponse } from "@/lib/serverSession";

/**
 * There's no /me route (section 16, decision 1). This page reads the identity
 * cookie server-side and renders either the first-visit or the welcome-back
 * state, which keeps Phase 1's single-page scroll intact.
 *
 * Reading the cookie makes the page dynamic. At this scale that's the right
 * trade — the alternative is splitting the shell from the personalised parts
 * to keep a static prerender that saves nothing measurable for a dozen guests.
 */
export default async function Home() {
  const respondent = await currentRespondent();
  const response = respondent ? await loadClientResponse(respondent) : null;

  return (
    <ResponseProvider initialResponse={response}>
      <Hero />
      <main className="w-full min-w-0 max-w-[980px] mx-auto px-6 py-14">
        <Section
          id="you"
          number="01"
          title="You"
          subtitle="Five quick questions, and the rest of the page tailors itself to your answers. Nothing here is a commitment, and everything saves itself as you go."
        >
          <WelcomeBack />
          <IntakeForm />
        </Section>

        <Section
          id="destinations"
          number="02"
          title="Where to go"
          subtitle="Skiing is one part of the weekend, not the whole point. Each option below is the mountain, the town, the food, and what else there is to do."
        >
          <DestinationRanker />
        </Section>

        <Section
          id="dates"
          number="03"
          title="When to go"
          subtitle="Window is mid-January through mid-March 2027 — snow is typically most reliable in this stretch. (If it lines up, this window also happens to sit right around Ben's birthday — a nice bonus, not the driver.)"
        >
          <div className="bg-paper border border-line rounded-xl p-5">
            <p className="text-sm text-ink mb-2">
              One thing worth knowing before you mark days: the Ikon Session
              Pass — what most guests will actually buy — blacks out on{" "}
              <strong>January 16–17</strong> and <strong>February 13–14, 2027</strong>{" "}
              at both Steamboat and Winter Park. Copper Mountain has no
              blackout dates on any Ikon tier.
            </p>
            <p className="text-xs text-ink-soft">
              {passInfo.reservationsRequired
                ? "Some resorts on the Ikon network require advance lift reservations."
                : "None of these three resorts require advance Ikon lift reservations this season."}
            </p>
            <SourceLine sources={passSources} />
          </div>

          <div className="mt-4">
            <AvailabilityGrid />
          </div>
        </Section>

        <Section
          id="getting-there"
          number="04"
          title="Getting there"
          subtitle="Where to check current fares — Google Flights has the live prices."
        >
          <FlightCards />
        </Section>

        <Section
          id="costs"
          number="05"
          title="What it'll cost you"
          subtitle="A rough per-person estimate, broken down by line item. Every figure here is a planning estimate, not a quote."
        >
          <CostSection />
        </Section>
      </main>
      <SaveBar />
      <Footer />
    </ResponseProvider>
  );
}
