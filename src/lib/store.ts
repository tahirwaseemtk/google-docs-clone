import { randomUUID } from "node:crypto";
import type { Db } from "./db";
import { AppError } from "./errors";
import { sanitizeContent } from "./content";
import type {
  AccessRole,
  DocumentDetail,
  DocumentList,
  DocumentSummary,
  SessionUser,
  ShareInfo,
  ShareRole,
  UserOption,
} from "./types";

// This module is the only place that decides who can see or change a document.
// Routes call these functions and map AppError to HTTP status codes.

const DEFAULT_TITLE = "Untitled document";

/** Runs a query and returns each row as a plain object keyed by column name. */
async function all<T>(db: Db, sql: string, args: (string | number | null)[] = []): Promise<T[]> {
  const result = await db.execute({ sql, args });
  return result.rows.map(
    (row) => Object.fromEntries(result.columns.map((col, i) => [col, row[i]])) as T,
  );
}

async function first<T>(db: Db, sql: string, args: (string | number | null)[] = []): Promise<T | undefined> {
  return (await all<T>(db, sql, args))[0];
}

export async function listUsers(db: Db): Promise<UserOption[]> {
  return all<UserOption>(db, "SELECT username, display_name AS displayName FROM users ORDER BY username");
}

export async function findUserById(db: Db, id: string): Promise<SessionUser | undefined> {
  return first<SessionUser>(db, "SELECT id, username, display_name AS displayName FROM users WHERE id = ?", [id]);
}

export async function findUserByUsername(db: Db, username: string): Promise<SessionUser | undefined> {
  return first<SessionUser>(
    db,
    "SELECT id, username, display_name AS displayName FROM users WHERE username = ?",
    [username.trim().toLowerCase()],
  );
}

/** Returns the caller's role on a document, or null if they have no access. */
export async function getAccess(db: Db, documentId: string, userId: string): Promise<AccessRole | null> {
  const doc = await first<{ owner_id: string }>(db, "SELECT owner_id FROM documents WHERE id = ?", [documentId]);
  if (!doc) return null;
  if (doc.owner_id === userId) return "owner";
  const share = await first<{ role: ShareRole }>(
    db,
    "SELECT role FROM document_shares WHERE document_id = ? AND user_id = ?",
    [documentId, userId],
  );
  return share?.role ?? null;
}

const ROLE_RANK: Record<AccessRole, number> = { viewer: 1, editor: 2, owner: 3 };

/**
 * Throws 404 when the user cannot see the document at all (so its existence is not leaked),
 * and 403 when they can see it but lack the required role.
 */
async function requireAccess(db: Db, documentId: string, userId: string, minimum: AccessRole): Promise<AccessRole> {
  const role = await getAccess(db, documentId, userId);
  if (!role) throw new AppError(404, "Document not found");
  if (ROLE_RANK[role] < ROLE_RANK[minimum]) {
    throw new AppError(
      403,
      minimum === "owner" ? "Only the owner can do that" : "You have view-only access to this document",
    );
  }
  return role;
}

interface SummaryRow {
  id: string;
  title: string;
  updated_at: string;
  owner_name: string;
}

function toSummary(row: SummaryRow): DocumentSummary {
  return { id: row.id, title: row.title, ownerName: row.owner_name, updatedAt: row.updated_at };
}

export async function listDocumentsForUser(db: Db, userId: string): Promise<DocumentList> {
  const owned = await all<SummaryRow>(
    db,
    `SELECT d.id, d.title, d.updated_at, u.display_name AS owner_name
     FROM documents d JOIN users u ON u.id = d.owner_id
     WHERE d.owner_id = ? ORDER BY d.updated_at DESC`,
    [userId],
  );

  const shared = await all<SummaryRow & { role: ShareRole }>(
    db,
    `SELECT d.id, d.title, d.updated_at, u.display_name AS owner_name, s.role
     FROM document_shares s
     JOIN documents d ON d.id = s.document_id
     JOIN users u ON u.id = d.owner_id
     WHERE s.user_id = ? ORDER BY d.updated_at DESC`,
    [userId],
  );

  return {
    owned: owned.map(toSummary),
    shared: shared.map((row) => ({ ...toSummary(row), role: row.role })),
  };
}

export async function createDocument(
  db: Db,
  ownerId: string,
  input: { title?: string; contentHtml?: string },
): Promise<string> {
  const id = randomUUID();
  const now = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO documents (id, title, content_html, owner_id, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      input.title?.trim() || DEFAULT_TITLE,
      sanitizeContent(input.contentHtml ?? ""),
      ownerId,
      now,
      now,
    ],
  });
  return id;
}

export async function getDocumentDetail(db: Db, documentId: string, userId: string): Promise<DocumentDetail> {
  const role = await getAccess(db, documentId, userId);
  if (!role) throw new AppError(404, "Document not found");

  const row = await first<{
    id: string;
    title: string;
    content_html: string;
    owner_id: string;
    owner_name: string;
    created_at: string;
    updated_at: string;
  }>(
    db,
    `SELECT d.id, d.title, d.content_html, d.owner_id, d.created_at, d.updated_at, u.display_name AS owner_name
     FROM documents d JOIN users u ON u.id = d.owner_id WHERE d.id = ?`,
    [documentId],
  );
  if (!row) throw new AppError(404, "Document not found");

  const shares = await all<ShareInfo>(
    db,
    `SELECT u.id AS userId, u.username, u.display_name AS displayName, s.role
     FROM document_shares s JOIN users u ON u.id = s.user_id
     WHERE s.document_id = ? ORDER BY u.username`,
    [documentId],
  );

  return {
    id: row.id,
    title: row.title,
    contentHtml: row.content_html,
    ownerId: row.owner_id,
    ownerName: row.owner_name,
    role,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    shares,
  };
}

export async function updateDocument(
  db: Db,
  documentId: string,
  userId: string,
  patch: { title?: string; contentHtml?: string },
): Promise<void> {
  await requireAccess(db, documentId, userId, "editor");

  const sets: string[] = [];
  const args: string[] = [];
  if (patch.title !== undefined) {
    sets.push("title = ?");
    args.push(patch.title.trim() || DEFAULT_TITLE);
  }
  if (patch.contentHtml !== undefined) {
    sets.push("content_html = ?");
    args.push(sanitizeContent(patch.contentHtml));
  }
  if (sets.length === 0) return;

  sets.push("updated_at = ?");
  args.push(new Date().toISOString(), documentId);
  await db.execute({ sql: `UPDATE documents SET ${sets.join(", ")} WHERE id = ?`, args });
}

export async function deleteDocument(db: Db, documentId: string, userId: string): Promise<void> {
  await requireAccess(db, documentId, userId, "owner");
  // Delete shares explicitly: foreign-key cascades are not guaranteed on every connection.
  await db.batch(
    [
      { sql: "DELETE FROM document_shares WHERE document_id = ?", args: [documentId] },
      { sql: "DELETE FROM documents WHERE id = ?", args: [documentId] },
    ],
    "write",
  );
}

/** Grants (or changes) a user's role on a document. Only the owner may share. */
export async function shareDocument(
  db: Db,
  documentId: string,
  actorId: string,
  targetUsername: string,
  role: ShareRole,
): Promise<void> {
  await requireAccess(db, documentId, actorId, "owner");

  const target = await findUserByUsername(db, targetUsername);
  if (!target) throw new AppError(404, `No user named "${targetUsername.trim().toLowerCase()}"`);

  const owner = await first<{ owner_id: string }>(db, "SELECT owner_id FROM documents WHERE id = ?", [documentId]);
  if (target.id === owner?.owner_id) throw new AppError(400, "The owner already has full access");

  await db.execute({
    sql: `INSERT INTO document_shares (document_id, user_id, role, created_at) VALUES (?, ?, ?, ?)
          ON CONFLICT (document_id, user_id) DO UPDATE SET role = excluded.role`,
    args: [documentId, target.id, role, new Date().toISOString()],
  });
}

export async function unshareDocument(db: Db, documentId: string, actorId: string, targetUserId: string): Promise<void> {
  await requireAccess(db, documentId, actorId, "owner");
  await db.execute({
    sql: "DELETE FROM document_shares WHERE document_id = ? AND user_id = ?",
    args: [documentId, targetUserId],
  });
}
