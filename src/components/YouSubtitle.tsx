"use client";

import { useResponse } from "./ResponseProvider";

/**
 * Section 01's subtitle. A guest who has bowed out shouldn't still be told
 * the section is five quick questions — but the rest of the page stays
 * browsable, so the replacement says that rather than shutting the door.
 */
export function YouSubtitle() {
  const { declinedOnly } = useResponse();

  if (declinedOnly) {
    return (
      <>
        You&rsquo;ve let Ben know you can&rsquo;t make it — the rest of the page
        is still here to browse if you&rsquo;re curious.
      </>
    );
  }

  return (
    <>
      Five quick questions, and the rest of the page tailors itself to your
      answers. Nothing here is a commitment.
    </>
  );
}
