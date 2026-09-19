import type { ReactNode } from "react";

/** The "nothing here yet" placeholder shared by every admin section. */
export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="text-sm text-ink-soft border border-line rounded-lg p-4">{children}</p>
  );
}
