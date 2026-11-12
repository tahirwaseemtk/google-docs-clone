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

interface DocRow {
  id: string;
  title: string;
  content_html: string;
  owner_id: string;
  owner_name: string;
  created_at: string;
  updated_at: string;
}

export function listUsers(db: Db): UserOption[] {
  return db
    .prepare("SELECT username, display_name AS displayName FROM users ORDER BY username")
    .all() as UserOption[];
}

export function findUserById(db: Db, id: string): SessionUser | undefined {
  return db
    .prepare("SELECT id, username, display_name AS displayName FROM users WHERE id = ?")
    .get(id) as SessionUser | undefined;
}

export function findUserByUsername(db: Db, username: string): SessionUser | undefined {
  return db
    .prepare("SELECT id, username, display_name AS displayName FROM users WHERE username = ?")
    .get(username.trim().toLowerCase()) as SessionUser | undefined;
}

/** Returns the caller's role on a document, or null if they have no access. */
export function getAccess(db: Db, documentId: string, userId: string): AccessRole | null {
  const doc = db.prepare("SELECT owner_id FROM documents WHERE id = ?").get(documentId) as
    | { owner_id: string }
    | undefined;
  if (!doc) return null;
  if (doc.owner_id === userId) return "owner";
  const share = db
    .prepare("SELECT role FROM document_shares WHERE document_id = ? AND user_id = ?")
    .get(documentId, userId) as { role: ShareRole } | undefined;
  return share?.role ?? null;
}

const ROLE_RANK: Record<AccessRole, number> = { viewer: 1, editor: 2, owner: 3 };

/**
 * Throws 404 when the user cannot see the document at all (so its existence is not leaked),
 * and 403 when they can see it but lack the required role.
 */
function requireAccess(db: Db, documentId: string, userId: string, minimum: AccessRole): AccessRole {
  const role = getAccess(db, documentId, userId);
  if (!role) throw new AppError(404, "Document not found");
  if (ROLE_RANK[role] < ROLE_RANK[minimum]) {
    throw new AppError(
      403,
      minimum === "owner" ? "Only the owner can do that" : "You have view-only access to this document",
    );
  }
  return role;
}

function toSummary(row: { id: string; title: string; owner_name: string; updated_at: string }): DocumentSummary {
  return { id: row.id, title: row.title, ownerName: row.owner_name, updatedAt: row.updated_at };
}

export function listDocumentsForUser(db: Db, userId: string): DocumentList {
  const owned = db
    .prepare(
      `SELECT d.id, d.title, d.updated_at, u.display_name AS owner_name
       FROM documents d JOIN users u ON u.id = d.owner_id
       WHERE d.owner_id = ? ORDER BY d.updated_at DESC`,
    )
    .all(userId) as Array<{ id: string; title: string; updated_at: string; owner_name: string }>;

  const shared = db
    .prepare(
      `SELECT d.id, d.title, d.updated_at, u.display_name AS owner_name, s.role
       FROM document_shares s
       JOIN documents d ON d.id = s.document_id
       JOIN users u ON u.id = d.owner_id
       WHERE s.user_id = ? ORDER BY d.updated_at DESC`,
    )
    .all(userId) as Array<{ id: string; title: string; updated_at: string; owner_name: string; role: ShareRole }>;

  return {
    owned: owned.map(toSummary),
    shared: shared.map((row) => ({ ...toSummary(row), role: row.role })),
  };
}

export function createDocument(
  db: Db,
  ownerId: string,
  input: { title?: string; contentHtml?: string },
): string {
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO documents (id, title, content_html, owner_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.title?.trim() || DEFAULT_TITLE,
    sanitizeContent(input.contentHtml ?? ""),
    ownerId,
    now,
    now,
  );
  return id;
}

export function getDocumentDetail(db: Db, documentId: string, userId: string): DocumentDetail {
  const role = getAccess(db, documentId, userId);
  if (!role) throw new AppError(404, "Document not found");

  const row = db
    .prepare(
      `SELECT d.id, d.title, d.content_html, d.owner_id, d.created_at, d.updated_at, u.display_name AS owner_name
       FROM documents d JOIN users u ON u.id = d.owner_id WHERE d.id = ?`,
    )
    .get(documentId) as DocRow;

  const shares = db
    .prepare(
      `SELECT u.id AS userId, u.username, u.display_name AS displayName, s.role
       FROM document_shares s JOIN users u ON u.id = s.user_id
       WHERE s.document_id = ? ORDER BY u.username`,
    )
    .all(documentId) as ShareInfo[];

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

export function updateDocument(
  db: Db,
  documentId: string,
  userId: string,
  patch: { title?: string; contentHtml?: string },
): void {
  requireAccess(db, documentId, userId, "editor");

  const sets: string[] = [];
  const values: unknown[] = [];
  if (patch.title !== undefined) {
    sets.push("title = ?");
    values.push(patch.title.trim() || DEFAULT_TITLE);
  }
  if (patch.contentHtml !== undefined) {
    sets.push("content_html = ?");
    values.push(sanitizeContent(patch.contentHtml));
  }
  if (sets.length === 0) return;

  sets.push("updated_at = ?");
  values.push(new Date().toISOString(), documentId);
  db.prepare(`UPDATE documents SET ${sets.join(", ")} WHERE id = ?`).run(...values);
}

export function deleteDocument(db: Db, documentId: string, userId: string): void {
  requireAccess(db, documentId, userId, "owner");
  db.prepare("DELETE FROM documents WHERE id = ?").run(documentId);
}

/** Grants (or changes) a user's role on a document. Only the owner may share. */
export function shareDocument(
  db: Db,
  documentId: string,
  actorId: string,
  targetUsername: string,
  role: ShareRole,
): void {
  requireAccess(db, documentId, actorId, "owner");

  const target = findUserByUsername(db, targetUsername);
  if (!target) throw new AppError(404, `No user named "${targetUsername.trim().toLowerCase()}"`);

  const owner = db.prepare("SELECT owner_id FROM documents WHERE id = ?").get(documentId) as { owner_id: string };
  if (target.id === owner.owner_id) throw new AppError(400, "The owner already has full access");

  db.prepare(
    `INSERT INTO document_shares (document_id, user_id, role, created_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (document_id, user_id) DO UPDATE SET role = excluded.role`,
  ).run(documentId, target.id, role, new Date().toISOString());
}

export function unshareDocument(db: Db, documentId: string, actorId: string, targetUserId: string): void {
  requireAccess(db, documentId, actorId, "owner");
  db.prepare("DELETE FROM document_shares WHERE document_id = ? AND user_id = ?").run(documentId, targetUserId);
}
