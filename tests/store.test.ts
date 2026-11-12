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

beforeEach(async () => {
  db = await openDatabase(":memory:");
  alice = (await findUserByUsername(db, "alice"))!.id;
  bob = (await findUserByUsername(db, "bob"))!.id;
  carol = (await findUserByUsername(db, "carol"))!.id;
});

afterEach(() => db.close());

async function expectStatus(fn: () => Promise<unknown>, status: number) {
  try {
    await fn();
  } catch (err) {
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).status).toBe(status);
    return;
  }
  throw new Error(`Expected AppError with status ${status}`);
}

describe("access control", () => {
  it("gives the owner full access and strangers none", async () => {
    const docId = await createDocument(db, alice, { title: "Plan" });
    expect(await getAccess(db, docId, alice)).toBe("owner");
    expect(await getAccess(db, docId, bob)).toBeNull();
  });

  it("hides documents from users with no access (404, not 403)", async () => {
    const docId = await createDocument(db, alice, { title: "Secret" });
    await expectStatus(() => getDocumentDetail(db, docId, bob), 404);
    await expectStatus(() => updateDocument(db, docId, bob, { title: "Hacked" }), 404);
  });

  it("lets an editor change content but not delete or share", async () => {
    const docId = await createDocument(db, alice, { title: "Shared" });
    await shareDocument(db, docId, alice, "bob", "editor");

    await updateDocument(db, docId, bob, { contentHtml: "<p>Bob was here</p>" });
    expect((await getDocumentDetail(db, docId, bob)).contentHtml).toBe("<p>Bob was here</p>");

    await expectStatus(() => deleteDocument(db, docId, bob), 403);
    await expectStatus(() => shareDocument(db, docId, bob, "carol", "viewer"), 403);
  });

  it("makes a viewer read-only", async () => {
    const docId = await createDocument(db, alice, { title: "Read me" });
    await shareDocument(db, docId, alice, "carol", "viewer");

    expect((await getDocumentDetail(db, docId, carol)).role).toBe("viewer");
    await expectStatus(() => updateDocument(db, docId, carol, { title: "Nope" }), 403);
  });

  it("revokes access when the owner removes a share", async () => {
    const docId = await createDocument(db, alice, { title: "Temp" });
    await shareDocument(db, docId, alice, "bob", "editor");
    await unshareDocument(db, docId, alice, bob);

    expect(await getAccess(db, docId, bob)).toBeNull();
    await expectStatus(() => getDocumentDetail(db, docId, bob), 404);
  });

  it("does not let the owner be shared with, and reports unknown users", async () => {
    const docId = await createDocument(db, alice, {});
    await expectStatus(() => shareDocument(db, docId, alice, "alice", "viewer"), 400);
    await expectStatus(() => shareDocument(db, docId, alice, "nobody", "viewer"), 404);
  });

  it("removes shares when a document is deleted by its owner", async () => {
    const docId = await createDocument(db, alice, { title: "Gone soon" });
    await shareDocument(db, docId, alice, "bob", "editor");
    await deleteDocument(db, docId, alice);

    await expectStatus(() => getDocumentDetail(db, docId, bob), 404);
    const left = await db.execute({
      sql: "SELECT COUNT(*) AS n FROM document_shares WHERE document_id = ?",
      args: [docId],
    });
    expect(Number(left.rows[0][0])).toBe(0);
  });
});

describe("document listing", () => {
  it("separates owned documents from documents shared with the user", async () => {
    const aliceDoc = await createDocument(db, alice, { title: "Alice's doc" });
    await shareDocument(db, aliceDoc, alice, "bob", "editor");
    await createDocument(db, bob, { title: "Bob's doc" });

    const bobList = await listDocumentsForUser(db, bob);
    expect(bobList.owned.map((d) => d.title)).toEqual(["Bob's doc"]);
    // Bob also has the seeded sample doc shared with him, so look the new one up by title.
    expect(bobList.shared).toContainEqual(
      expect.objectContaining({ title: "Alice's doc", role: "editor", ownerName: "Alice Chen" }),
    );
  });

  it("includes the seeded sample document shared with Bob and Carol", async () => {
    const carolList = await listDocumentsForUser(db, carol);
    expect(carolList.shared.map((d) => d.title)).toContain("Welcome to Ajaia Docs");
  });
});

describe("persistence", () => {
  it("keeps sanitized content and updated titles on reload", async () => {
    const docId = await createDocument(db, alice, { title: "  Draft  " });
    await updateDocument(db, docId, alice, {
      title: "Final",
      contentHtml: '<h2 onclick="x()">Heading</h2><script>alert(1)</script><p><b>bold</b></p>',
    });

    const reloaded = await getDocumentDetail(db, docId, alice);
    expect(reloaded.title).toBe("Final");
    expect(reloaded.contentHtml).toBe("<h2>Heading</h2><p><b>bold</b></p>");
  });
});
