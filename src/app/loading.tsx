import { Hero } from "@/components/Hero";

export default function Loading() {
  return (
    <>
      <Hero />
      <main className="w-full min-w-0 max-w-[980px] mx-auto px-6 py-14">
        <p className="text-sm text-ink-soft">Loading your answers&hellip;</p>
      </main>
    </>
  );
}
