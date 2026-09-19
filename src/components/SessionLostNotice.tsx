"use client";

import { useResponse } from "./ResponseProvider";

/**
 * Shown when a background save 404s: the identity cookie pointed at a row
 * that's gone (deleted, merged, or just stale). The server has already
 * cleared the cookie, so starting fresh below is a normal first visit, not a
 * dead end.
 */
export function SessionLostNotice() {
  const { sessionLost } = useResponse();
  if (!sessionLost) return null;

  return (
    <p className="text-sm text-ink border border-rust bg-[#F6DAD6] rounded-lg p-4 max-w-[60ch] mb-8">
      Couldn&rsquo;t find your saved answers on this device — start fresh
      below; nothing else is affected.
    </p>
  );
}
