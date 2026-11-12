import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { errorResponse, readJson, requireUser } from "@/lib/http";
import { createDocument, listDocumentsForUser } from "@/lib/store";
import { createDocumentSchema } from "@/lib/validation";

export async function GET(req: NextRequest) {
  try {
    const db = getDb();
    const user = requireUser(req, db);
    return NextResponse.json(listDocumentsForUser(db, user.id));
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const db = getDb();
    const user = requireUser(req, db);
    const body = createDocumentSchema.parse((await readJson(req).catch(() => ({}))) ?? {});
    const id = createDocument(db, user.id, { title: body.title });
    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
