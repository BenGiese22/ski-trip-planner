import { NextResponse } from "next/server";
import type { ZodError } from "zod";

export function badRequest(error: ZodError): NextResponse {
  return NextResponse.json(
    {
      error: "Invalid request",
      // Field-level detail, not the raw Zod tree — enough for the client to
      // point at the offending input without leaking schema internals.
      issues: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    },
    { status: 400 },
  );
}

export function noSuchRespondent(): NextResponse {
  return NextResponse.json(
    { error: "No response found for this browser. Start with the intake form." },
    { status: 404 },
  );
}

/**
 * A malformed body is a 400, not a 500 — `request.json()` throws on invalid
 * JSON and an unhandled throw here would read as a server fault in the logs.
 */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
