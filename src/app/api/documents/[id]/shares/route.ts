import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { errorResponse, readJson, requireUser } from "@/lib/http";
import { getDocumentDetail, shareDocument } from "@/lib/store";
import { shareSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const db = getDb();
    const user = requireUser(req, db);
    const { id } = await params;
    const doc = getDocumentDetail(db, id, user.id);
    return NextResponse.json({ shares: doc.shares });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const db = getDb();
    const user = requireUser(req, db);
    const { id } = await params;
    const { username, role } = shareSchema.parse(await readJson(req));
    shareDocument(db, id, user.id, username, role);
    const doc = getDocumentDetail(db, id, user.id);
    return NextResponse.json({ shares: doc.shares }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
