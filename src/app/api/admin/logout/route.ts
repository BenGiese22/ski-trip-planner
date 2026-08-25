import { NextResponse } from "next/server";
import { ADMIN_COOKIE, adminCookieOptions } from "@/lib/adminSession";
import { isSecureRequest } from "@/lib/session";

/** §17 decision 7 — this gets opened on a phone. */
export async function POST(request: Request) {
  const response = NextResponse.json({ ok: true });

  // Same options as when it was set: a cookie is only cleared if the name,
  // path and flags all match, and this one is scoped to /admin rather than /.
  response.cookies.set(ADMIN_COOKIE, "", {
    ...adminCookieOptions({ secure: isSecureRequest(request) }),
    maxAge: 0,
  });
  return response;
}
