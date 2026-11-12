import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { listUsers } from "@/lib/store";

// Lists demo accounts (usernames and display names only) for the sign-in and share pickers.
export async function GET() {
  return NextResponse.json({ users: listUsers(getDb()) });
}
