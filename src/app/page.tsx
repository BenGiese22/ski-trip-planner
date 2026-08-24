import { CostSection } from "@/components/CostSection";
import { DestinationCard } from "@/components/DestinationCard";
import { FlightCards } from "@/components/FlightCards";
import { Footer } from "@/components/Footer";
import { Hero } from "@/components/Hero";
import { Section } from "@/components/Section";
import { SourceLine } from "@/components/SourceLine";
import { destinations } from "@/data/destinations";
import { passInfo, passSources } from "@/data/passInfo";

export default function Home() {
  return (
    <>
      <Hero />
      <main className="max-w-[980px] mx-auto px-6 py-14">
        <Section
          id="destinations"
          number="01"
          title="Where to go"
          subtitle="Skiing is one part of the weekend, not the whole point. Each option below is the mountain, the town, the food, and what else there is to do."
        >
          <div className="flex flex-col gap-3.5">
            {destinations.map((destination) => (
              <DestinationCard key={destination.slug} destination={destination} />
            ))}
          </div>
        </Section>

        <Section
          id="dates"
          number="02"
          title="When to go"
          subtitle="Window is mid-January through mid-March 2027 — snow is typically most reliable in this stretch. (If it lines up, this window also happens to sit right around Ben's birthday — a nice bonus, not the driver.)"
        >
          <div className="bg-paper border border-line rounded-xl p-5">
            <p className="text-sm text-ink mb-2">
              Most of the group will pick from this window once dates firm
              up. One thing worth knowing ahead of time: the Ikon Session
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
        </Section>

        <Section
          id="getting-there"
          number="03"
          title="Getting there"
          subtitle="Flight links for each home airport in the group — check current fares directly on Google Flights."
        >
          <FlightCards />
        </Section>

        <Section
          id="costs"
          number="04"
          title="What it'll cost you"
          subtitle="A rough per-person estimate, broken down by line item. Once everyone's told us their airport, ski days, and gear plans, this becomes personalized instead of an example."
        >
          <CostSection />
        </Section>
      </main>
      <Footer />
    </>
  );
}
