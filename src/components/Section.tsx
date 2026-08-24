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
    <section id={id} className="relative pl-[52px] mb-16 scroll-mt-6">
      <div className="absolute left-0 top-0.5 w-9 h-9 rounded-full bg-paper border-2 border-pine flex items-center justify-center font-mono text-[13px] font-semibold text-pine">
        {number}
      </div>
      <h2 className="text-2xl mb-1.5">{title}</h2>
      {subtitle && <p className="text-sm text-ink-soft max-w-[60ch] mb-5">{subtitle}</p>}
      {children}
    </section>
  );
}
