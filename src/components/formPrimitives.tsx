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

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-xs text-rust mt-1">
      {message}
    </p>
  );
}
