import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import type { Db } from "./db";
import { AppError } from "./errors";
import { findUserById } from "./store";
import type { SessionUser } from "./types";

// Mock authentication: the cookie holds the seeded user's id. It is NOT signed and is only
// suitable for this assessment. A real deployment would use a signed session or an identity provider.
export const SESSION_COOKIE = "ajaia_session";

export async function currentUser(req: NextRequest, db: Db): Promise<SessionUser | null> {
  const id = req.cookies.get(SESSION_COOKIE)?.value;
  if (!id) return null;
  return (await findUserById(db, id)) ?? null;
}

export async function requireUser(req: NextRequest, db: Db): Promise<SessionUser> {
  const user = await currentUser(req, db);
  if (!user) throw new AppError(401, "Sign in to continue");
  return user;
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new AppError(400, "Request body must be valid JSON");
  }
}

/** Converts any thrown error into a JSON response with a safe message. */
export function errorResponse(err: unknown): NextResponse {
  if (err instanceof AppError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  if (err instanceof ZodError) {
    return NextResponse.json({ error: err.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }
  console.error(err);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}
