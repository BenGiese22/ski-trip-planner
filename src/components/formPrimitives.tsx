/**
 * The shared look and error affordance for every guest-facing form field.
 * Extracted from IntakeForm so the decline form matches it exactly rather
 * than by eye.
 */

// iOS Safari zooms the whole page in on focus for any input/select under 16px.
export const fieldClasses =
  "w-full border border-line rounded-md px-3 py-2.5 text-base sm:text-sm bg-paper text-ink " +
  "focus:outline-2 focus:outline-offset-2 focus:outline-pine";

export const labelClasses =
  "block font-mono text-[11px] uppercase tracking-wide text-ink-soft mb-1.5";

export const primaryButtonClasses =
  "text-sm text-paper bg-pine px-4 py-2.5 rounded-md hover:bg-pine-dark " +
  "disabled:opacity-60 focus:outline-2 focus:outline-offset-2 focus:outline-pine";

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-xs text-rust mt-1">
      {message}
    </p>
  );
}

export function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0];
}
