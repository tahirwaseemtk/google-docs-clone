import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDatabase, type Db } from "@/lib/db";
import {
  createDocument,
  deleteDocument,
  findUserByUsername,
  getAccess,
  getDocumentDetail,
  listDocumentsForUser,
  shareDocument,
  unshareDocument,
  updateDocument,
} from "@/lib/store";
import { AppError } from "@/lib/errors";

// Each test gets a fresh in-memory database seeded with alice (owner), bob and carol.
let db: Db;
let alice: string;
let bob: string;
let carol: string;

beforeEach(() => {
  db = openDatabase(":memory:");
  alice = findUserByUsername(db, "alice")!.id;
  bob = findUserByUsername(db, "bob")!.id;
  carol = findUserByUsername(db, "carol")!.id;
});

afterEach(() => db.close());

function expectStatus(fn: () => unknown, status: number) {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).status).toBe(status);
    return;
  }
  throw new Error(`Expected AppError with status ${status}`);
}

describe("access control", () => {
  it("gives the owner full access and strangers none", () => {
    const docId = createDocument(db, alice, { title: "Plan" });
    expect(getAccess(db, docId, alice)).toBe("owner");
    expect(getAccess(db, docId, bob)).toBeNull();
  });

  it("hides documents from users with no access (404, not 403)", () => {
    const docId = createDocument(db, alice, { title: "Secret" });
    expectStatus(() => getDocumentDetail(db, docId, bob), 404);
    expectStatus(() => updateDocument(db, docId, bob, { title: "Hacked" }), 404);
  });

  it("lets an editor change content but not delete or share", () => {
    const docId = createDocument(db, alice, { title: "Shared" });
    shareDocument(db, docId, alice, "bob", "editor");

    updateDocument(db, docId, bob, { contentHtml: "<p>Bob was here</p>" });
    expect(getDocumentDetail(db, docId, bob).contentHtml).toBe("<p>Bob was here</p>");

    expectStatus(() => deleteDocument(db, docId, bob), 403);
    expectStatus(() => shareDocument(db, docId, bob, "carol", "viewer"), 403);
  });

  it("makes a viewer read-only", () => {
    const docId = createDocument(db, alice, { title: "Read me" });
    shareDocument(db, docId, alice, "carol", "viewer");

    expect(getDocumentDetail(db, docId, carol).role).toBe("viewer");
    expectStatus(() => updateDocument(db, docId, carol, { title: "Nope" }), 403);
  });

  it("revokes access when the owner removes a share", () => {
    const docId = createDocument(db, alice, { title: "Temp" });
    shareDocument(db, docId, alice, "bob", "editor");
    unshareDocument(db, docId, alice, bob);

    expect(getAccess(db, docId, bob)).toBeNull();
    expectStatus(() => getDocumentDetail(db, docId, bob), 404);
  });

  it("does not let the owner be shared with, and reports unknown users", () => {
    const docId = createDocument(db, alice, {});
    expectStatus(() => shareDocument(db, docId, alice, "alice", "viewer"), 400);
    expectStatus(() => shareDocument(db, docId, alice, "nobody", "viewer"), 404);
  });
});

describe("document listing", () => {
  it("separates owned documents from documents shared with the user", () => {
    const aliceDoc = createDocument(db, alice, { title: "Alice's doc" });
    shareDocument(db, aliceDoc, alice, "bob", "editor");
    createDocument(db, bob, { title: "Bob's doc" });

    const bobList = listDocumentsForUser(db, bob);
    expect(bobList.owned.map((d) => d.title)).toEqual(["Bob's doc"]);
    // Bob also has the seeded sample doc shared with him, so look the new one up by title.
    expect(bobList.shared).toContainEqual(
      expect.objectContaining({ title: "Alice's doc", role: "editor", ownerName: "Alice Chen" }),
    );
  });

  it("includes the seeded sample document shared with Bob and Carol", () => {
    const carolList = listDocumentsForUser(db, carol);
    expect(carolList.shared.map((d) => d.title)).toContain("Welcome to Ajaia Docs");
  });
});

describe("persistence", () => {
  it("keeps sanitized content and updated titles on reload", () => {
    const docId = createDocument(db, alice, { title: "  Draft  " });
    updateDocument(db, docId, alice, {
      title: "Final",
      contentHtml: '<h2 onclick="x()">Heading</h2><script>alert(1)</script><p><b>bold</b></p>',
    });

    const reloaded = getDocumentDetail(db, docId, alice);
    expect(reloaded.title).toBe("Final");
    expect(reloaded.contentHtml).toBe("<h2>Heading</h2><p><b>bold</b></p>");
  });
});
