import { NextResponse } from "next/server";
import { findDeclineByToken, upsertDecline, deleteDeclineByToken } from "@/db/queries";
import { badRequest, guestWriteLimit, readJson } from "@/lib/api";
import { declineSchema, declineReasonSchema } from "@/lib/schemas";
import {
  IDENTITY_COOKIE,
  createCookieToken,
  identityCookieOptions,
  isSecureRequest,
} from "@/lib/session";
import { currentRespondent, currentCookieToken, toClientDecline } from "@/lib/serverSession";

/**
 * POST serves two different entry points and picks its schema by identity
 * rather than by anything in the body:
 *
 * - Entry point B — a respondent row already exists. Name/email are already
 *   known, so only a reason is accepted, and the identity cookie is left
 *   untouched since it already points at that respondent.
 * - Entry point A — no respondent row. The guest supplies name/email
 *   themselves. A cookie that already resolves to a decline edits it in
 *   place (200); anyone else gets a fresh token and a new row (201).
 *
 * Never a 409 for an existing respondent — that's entry point B working as
 * intended, not a conflict.
 */
export async function POST(request: Request) {
  const limited = await guestWriteLimit(request);
  if (limited) return limited;

  const respondent = await currentRespondent();
  if (respondent) {
    const parsed = declineReasonSchema.safeParse(await readJson(request));
    if (!parsed.success) return badRequest(parsed.error);

    const decline = await upsertDecline(
      { name: respondent.name, email: respondent.email, reason: parsed.data.reason ?? null },
      respondent.cookieToken,
    );
    return NextResponse.json({ decline: toClientDecline(decline) }, { status: 201 });
  }

  const parsed = declineSchema.safeParse(await readJson(request));
  if (!parsed.success) return badRequest(parsed.error);

  const token = await currentCookieToken();
  if (token) {
    const existing = await findDeclineByToken(token);
    if (existing) {
      const decline = await upsertDecline(
        {
          name: parsed.data.name,
          email: parsed.data.email ?? null,
          reason: parsed.data.reason ?? null,
        },
        token,
      );
      return NextResponse.json({ decline: toClientDecline(decline) });
    }
  }

  const newToken = createCookieToken();
  const decline = await upsertDecline(
    {
      name: parsed.data.name,
      email: parsed.data.email ?? null,
      reason: parsed.data.reason ?? null,
    },
    newToken,
  );

  const response = NextResponse.json({ decline: toClientDecline(decline) }, { status: 201 });
  response.cookies.set(
    IDENTITY_COOKIE,
    newToken,
    identityCookieOptions({ secure: isSecureRequest(request) }),
  );
  return response;
}

/**
 * Undo, direction B only: a respondent who declined removes the decline row.
 * A decline-only visitor (no respondent row) undoes by completing intake
 * instead — a different code path in the respondents route — so that state
 * is rejected here rather than silently accepted.
 */
export async function DELETE(request: Request) {
  const limited = await guestWriteLimit(request);
  if (limited) return limited;

  const respondent = await currentRespondent();
  if (!respondent) {
    return NextResponse.json(
      { error: "There's no way to undo this without an existing response — start one instead." },
      { status: 409 },
    );
  }

  const deleted = await deleteDeclineByToken(respondent.cookieToken);
  if (!deleted) {
    return NextResponse.json(
      { error: "No \"can't make it\" on file for this browser." },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true });
}
