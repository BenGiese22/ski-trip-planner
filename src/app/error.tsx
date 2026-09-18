"use client";

/**
 * Last-resort boundary — everything else on the page tries hard to degrade
 * gracefully around a database outage (see WelcomeBack/IntakeForm's
 * `loadFailed` handling), so reaching this means something unexpected threw,
 * not just "the DB is down while loading a saved response."
 */
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center bg-snow">
      <h1 className="text-2xl font-serif font-bold">Something went wrong</h1>
      <p className="text-sm text-ink-soft max-w-[46ch]">
        That&rsquo;s on this app, not on you — nothing you filled in was lost.
        Try again in a moment.
      </p>
      <button
        onClick={reset}
        className="text-sm text-paper bg-pine px-4 py-2.5 rounded-md hover:bg-pine-dark focus:outline-2 focus:outline-offset-2 focus:outline-pine"
      >
        Try again
      </button>
    </div>
  );
}
