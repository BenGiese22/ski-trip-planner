"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AdminLogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch("/api/admin/logout", { method: "POST" });
        router.refresh();
        setBusy(false);
      }}
      className="text-xs text-ink-soft underline underline-offset-2 hover:text-ink focus:outline-2 focus:outline-offset-2 focus:outline-pine"
    >
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
