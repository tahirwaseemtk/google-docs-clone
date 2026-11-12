import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { markdownToContent, plainTextToContent, titleFromFilename } from "@/lib/content";
import { AppError } from "@/lib/errors";
import { errorResponse, requireUser } from "@/lib/http";
import { createDocument } from "@/lib/store";
import {
  ALLOWED_UPLOAD_EXTENSIONS,
  MAX_CONTENT_LENGTH,
  MAX_UPLOAD_BYTES,
  fileExtension,
} from "@/lib/validation";

/**
 * Imports a .txt or .md file as a new document owned by the current user.
 * Supported: .txt (paragraphs preserved) and .md (headings, lists, bold, italics). Max 1 MB.
 */
export async function POST(req: NextRequest) {
  try {
    const db = await getDb();
    const user = await requireUser(req, db);

    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) throw new AppError(400, "Choose a file to import");

    const ext = fileExtension(file.name);
    if (!ext || !(ALLOWED_UPLOAD_EXTENSIONS as readonly string[]).includes(ext)) {
      throw new AppError(415, "Unsupported file type. Import a .txt or .md file.");
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new AppError(413, "File is too large. The limit is 1 MB.");
    }

    const text = await file.text();
    if (text.includes("\u0000")) {
      throw new AppError(415, "This file does not look like plain text");
    }

    const contentHtml = ext === ".md" ? markdownToContent(text) : plainTextToContent(text);
    if (contentHtml.length > MAX_CONTENT_LENGTH) {
      throw new AppError(413, "The imported document is too large to save");
    }

    const id = await createDocument(db, user.id, {
      title: titleFromFilename(file.name),
      contentHtml,
    });
    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
