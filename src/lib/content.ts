import sanitizeHtml from "sanitize-html";
import { marked } from "marked";

// Only the formatting the editor produces is allowed. No attributes, no links, no scripts.
const ALLOWED_TAGS = [
  "p",
  "br",
  "div",
  "h1",
  "h2",
  "h3",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "ul",
  "ol",
  "li",
  "blockquote",
];

/** Strips every tag and attribute not on the allowlist. Used on every write. */
export function sanitizeContent(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {},
    allowedSchemes: [],
    disallowedTagsMode: "discard",
  });
}

/** Converts uploaded Markdown into sanitized editor HTML. */
export function markdownToContent(markdown: string): string {
  const html = marked.parse(markdown, { async: false }) as string;
  return sanitizeContent(html);
}

/** Converts plain text into paragraphs (blank lines split paragraphs, single newlines become <br>). */
export function plainTextToContent(text: string): string {
  const paragraphs = text
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  return paragraphs.map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`).join("");
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** "meeting-notes.md" -> "meeting-notes" */
export function titleFromFilename(filename: string): string {
  const base = filename.replace(/\.(txt|md)$/i, "").trim().slice(0, 200);
  return base || "Imported document";
}
