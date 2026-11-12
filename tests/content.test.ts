import { describe, expect, it } from "vitest";
import {
  markdownToContent,
  plainTextToContent,
  sanitizeContent,
  titleFromFilename,
} from "@/lib/content";
import { fileExtension } from "@/lib/validation";

describe("sanitizeContent", () => {
  it("removes scripts, event handlers and links", () => {
    const dirty = '<p onclick="steal()">Hi <a href="javascript:alert(1)">link</a></p><script>bad()</script>';
    const clean = sanitizeContent(dirty);
    expect(clean).not.toContain("script");
    expect(clean).not.toContain("onclick");
    expect(clean).not.toContain("href");
    expect(clean).toContain("Hi");
  });

  it("keeps the formatting the editor produces", () => {
    const html = "<h1>T</h1><p><strong>a</strong> <em>b</em> <u>c</u></p><ul><li>x</li></ul><ol><li>y</li></ol>";
    expect(sanitizeContent(html)).toBe(html);
  });
});

describe("file import conversion", () => {
  it("turns Markdown headings, lists and emphasis into formatted HTML", () => {
    const html = markdownToContent("# Title\n\nSome **bold** and *italic* text.\n\n- one\n- two");
    expect(html).toContain("<h1>Title</h1>");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<em>italic</em>");
    expect(html).toContain("<ul>");
    expect(html).toContain("<li>one</li>");
  });

  it("sanitizes raw HTML embedded in Markdown", () => {
    const html = markdownToContent('Hello <img src=x onerror="alert(1)"> world');
    expect(html).not.toContain("onerror");
    expect(html).not.toContain("<img");
  });

  it("escapes plain text and splits paragraphs on blank lines", () => {
    const html = plainTextToContent("<b>not bold</b>\nsecond line\n\nNew paragraph");
    expect(html).toBe("<p>&lt;b&gt;not bold&lt;/b&gt;<br>second line</p><p>New paragraph</p>");
  });

  it("derives a title from the filename", () => {
    expect(titleFromFilename("meeting-notes.md")).toBe("meeting-notes");
    expect(titleFromFilename(".txt")).toBe("Imported document");
  });

  it("reads extensions case-insensitively and rejects missing ones", () => {
    expect(fileExtension("Report.TXT")).toBe(".txt");
    expect(fileExtension("README")).toBeNull();
  });
});
