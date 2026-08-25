import { cookies } from "next/headers";
import { ADMIN_COOKIE, verifyAdminSession } from "./adminSession";

/**
 * Server-side admin gate. Reading this is deliberately cheap and does no
 * database work — `/admin` checks it *before* running any aggregate query, so
 * an unauthenticated request costs one HMAC verification and nothing else.
 */
export async function isAdminAuthenticated(): Promise<boolean> {
  const store = await cookies();
  return verifyAdminSession(
    store.get(ADMIN_COOKIE)?.value,
    process.env.ADMIN_COOKIE_SECRET,
  );
}
