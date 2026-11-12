import { z } from "zod";

export const MAX_TITLE_LENGTH = 200;
export const MAX_CONTENT_LENGTH = 500_000; // characters of HTML
export const MAX_UPLOAD_BYTES = 1024 * 1024; // 1 MB
export const ALLOWED_UPLOAD_EXTENSIONS = [".txt", ".md"] as const;

const title = z
  .string({ error: "Title must be text" })
  .trim()
  .min(1, "Title cannot be empty")
  .max(MAX_TITLE_LENGTH, `Title must be ${MAX_TITLE_LENGTH} characters or fewer`);

export const createDocumentSchema = z.object({
  title: title.optional().default("Untitled document"),
});

export const updateDocumentSchema = z
  .object({
    title: title.optional(),
    contentHtml: z
      .string({ error: "Content must be text" })
      .max(MAX_CONTENT_LENGTH, "Document is too large")
      .optional(),
  })
  .refine((v) => v.title !== undefined || v.contentHtml !== undefined, {
    message: "Nothing to update",
  });

export const shareSchema = z.object({
  username: z
    .string({ error: "Username is required" })
    .trim()
    .toLowerCase()
    .min(1, "Username is required")
    .max(64),
  role: z.enum(["editor", "viewer"], { error: "Role must be editor or viewer" }),
});

export const sessionSchema = z.object({
  username: z.string({ error: "Username is required" }).trim().toLowerCase().min(1, "Username is required"),
});

/** Returns the lowercase extension (with dot) or null if the filename has none. */
export function fileExtension(filename: string): string | null {
  const idx = filename.lastIndexOf(".");
  return idx === -1 ? null : filename.slice(idx).toLowerCase();
}
