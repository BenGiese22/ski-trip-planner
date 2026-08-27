import { NextResponse } from "next/server";
import { createRespondent, updateRespondent } from "@/db/queries";
import { badRequest, noSuchRespondent, guestWriteLimit, readJson } from "@/lib/api";
import { intakeSchema, respondentPatchSchema } from "@/lib/schemas";
import {
  IDENTITY_COOKIE,
  createCookieToken,
  identityCookieOptions,
  isSecureRequest,
} from "@/lib/session";
import { currentRespondent, loadClientResponse } from "@/lib/serverSession";

/**
 * Creates the respondent row. Nothing is written before this point — intake
 * has to be complete first (PLAN.md section 16, decision 7), which is why the
 * body is validated against the full intake schema rather than a partial one.
 *
 * Idempotent for a browser that already has a row: re-posting edits the
 * existing response instead of creating a duplicate.
 */
export async function POST(request: Request) {
  const limited = await guestWriteLimit(request);
  if (limited) return limited;

  const parsed = intakeSchema.safeParse(await readJson(request));
  if (!parsed.success) return badRequest(parsed.error);

  const existing = await currentRespondent();
  if (existing) {
    const updated = await updateRespondent(existing, parsed.data);
    return NextResponse.json({ response: await loadClientResponse(updated) });
  }

  const token = createCookieToken();
  const created = await createRespondent(parsed.data, token);

  const response = NextResponse.json(
    { response: await loadClientResponse(created) },
    { status: 201 },
  );
  response.cookies.set(
    IDENTITY_COOKIE,
    token,
    identityCookieOptions({ secure: isSecureRequest(request) }),
  );
  return response;
}

/**
 * The autosave path. Deliberately unvalidated beyond shape: an incomplete row
 * sitting in the database mid-session is fine, and gating this on
 * completeness would defeat "close the tab and come back" (section 6).
 */
export async function PATCH(request: Request) {
  const limited = await guestWriteLimit(request);
  if (limited) return limited;

  const respondent = await currentRespondent();
  if (!respondent) return noSuchRespondent();

  const parsed = respondentPatchSchema.safeParse(await readJson(request));
  if (!parsed.success) return badRequest(parsed.error);

  const updated = await updateRespondent(respondent, parsed.data);
  return NextResponse.json({ response: await loadClientResponse(updated) });
}

export async function GET() {
  const respondent = await currentRespondent();
  if (!respondent) return NextResponse.json({ response: null });
  return NextResponse.json({ response: await loadClientResponse(respondent) });
}
