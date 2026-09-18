import type { ReactNode } from "react";

export function Section({
  id,
  number,
  title,
  subtitle,
  children,
}: {
  id: string;
  number: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="relative sm:pl-[52px] mb-16 scroll-mt-6">
      {/* Static above the heading below sm instead of absolutely positioned —
          absolute would otherwise reserve ~50px of horizontal width from a
          budget a narrow phone doesn't have. */}
      <div className="inline-flex w-9 h-9 rounded-full bg-paper border-2 border-pine items-center justify-center font-mono text-[13px] font-semibold text-pine mb-2 sm:mb-0 sm:absolute sm:left-0 sm:top-0.5">
        {number}
      </div>
      <h2 className="text-2xl mb-1.5">{title}</h2>
      {subtitle && <p className="text-sm text-ink-soft max-w-[60ch] mb-5">{subtitle}</p>}
      {children}
    </section>
  );
}
