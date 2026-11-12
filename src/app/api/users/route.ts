import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { errorResponse } from "@/lib/http";
import { listUsers } from "@/lib/store";

// Lists demo accounts (usernames and display names only) for the sign-in and share pickers.
export async function GET() {
  try {
    return NextResponse.json({ users: await listUsers(await getDb()) });
  } catch (err) {
    return errorResponse(err);
  }
}
