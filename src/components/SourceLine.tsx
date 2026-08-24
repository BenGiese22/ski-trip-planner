import type { Source } from "@/data/types";

export function SourceLine({ sources }: { sources: Source[] }) {
  if (sources.length === 0) return null;

  return (
    <p className="text-xs text-ink-soft mt-2.5">
      Sources:{" "}
      {sources.map((source, i) => (
        <span key={source.url}>
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-pine-dark underline underline-offset-2 hover:text-pine"
          >
            {source.label}
          </a>
          {i < sources.length - 1 ? ", " : ""}
        </span>
      ))}
    </p>
  );
}
