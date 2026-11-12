import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { SESSION_COOKIE, currentUser, errorResponse, readJson } from "@/lib/http";
import { findUserByUsername } from "@/lib/store";
import { sessionSchema } from "@/lib/validation";

export async function GET(req: NextRequest) {
  const user = currentUser(req, getDb());
  return NextResponse.json({ user });
}

/** Mock sign-in: picks a seeded account by username. No password. */
export async function POST(req: NextRequest) {
  try {
    const { username } = sessionSchema.parse(await readJson(req));
    const user = findUserByUsername(getDb(), username);
    if (!user) throw new AppError(404, `No demo account named "${username}"`);

    const res = NextResponse.json({ user });
    res.cookies.set(SESSION_COOKIE, user.id, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return res;
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
