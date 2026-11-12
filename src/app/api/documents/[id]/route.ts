import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { errorResponse, readJson, requireUser } from "@/lib/http";
import { deleteDocument, getDocumentDetail, updateDocument } from "@/lib/store";
import { updateDocumentSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const db = getDb();
    const user = requireUser(req, db);
    const { id } = await params;
    return NextResponse.json(getDocumentDetail(db, id, user.id));
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const db = getDb();
    const user = requireUser(req, db);
    const { id } = await params;
    const patch = updateDocumentSchema.parse(await readJson(req));
    updateDocument(db, id, user.id, patch);
    return NextResponse.json({ ok: true, updatedAt: new Date().toISOString() });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    const db = getDb();
    const user = requireUser(req, db);
    const { id } = await params;
    deleteDocument(db, id, user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
