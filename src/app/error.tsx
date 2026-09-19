"use client";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="w-full min-w-0 max-w-[980px] mx-auto px-6 py-14">
      <div className="border border-rust bg-[#F6DAD6] rounded-lg p-5 max-w-[60ch]">
        <p className="text-sm text-ink mb-4">
          Couldn&rsquo;t load this page just now — something broke on the
          way. Nothing is lost; try again in a moment.
        </p>
        <button
          type="button"
          onClick={reset}
          className="text-sm text-paper bg-pine px-4 py-2.5 rounded-md hover:bg-pine-dark focus:outline-2 focus:outline-offset-2 focus:outline-pine"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
