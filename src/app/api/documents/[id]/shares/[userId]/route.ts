import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { errorResponse, requireUser } from "@/lib/http";
import { getDocumentDetail, unshareDocument } from "@/lib/store";

type Ctx = { params: Promise<{ id: string; userId: string }> };

export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    const db = getDb();
    const user = requireUser(req, db);
    const { id, userId } = await params;
    unshareDocument(db, id, user.id, userId);
    const doc = getDocumentDetail(db, id, user.id);
    return NextResponse.json({ shares: doc.shares });
  } catch (err) {
    return errorResponse(err);
  }
}
