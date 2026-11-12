import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

export type Db = Database.Database;

const globalForDb = globalThis as unknown as { __ajaiaDb?: Db };

/** Shared database handle for the running server (one per process). */
export function getDb(): Db {
  if (!globalForDb.__ajaiaDb) {
    const file = process.env.DATA_FILE ?? path.join(process.cwd(), "data", "app.db");
    globalForDb.__ajaiaDb = openDatabase(file);
  }
  return globalForDb.__ajaiaDb;
}

/** Opens (and migrates + seeds) a database file. Use ":memory:" in tests. */
export function openDatabase(file: string): Db {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  seed(db);
  return db;
}

function migrate(db: Db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id           TEXT PRIMARY KEY,
      username     TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS documents (
      id           TEXT PRIMARY KEY,
      title        TEXT NOT NULL,
      content_html TEXT NOT NULL DEFAULT '',
      owner_id     TEXT NOT NULL REFERENCES users(id),
      created_at   TEXT NOT NULL,
      updated_at   TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS document_shares (
      document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role        TEXT NOT NULL CHECK (role IN ('editor', 'viewer')),
      created_at  TEXT NOT NULL,
      PRIMARY KEY (document_id, user_id)
    );

    CREATE INDEX IF NOT EXISTS idx_documents_owner ON documents(owner_id);
    CREATE INDEX IF NOT EXISTS idx_shares_user ON document_shares(user_id);
  `);
}

const SEED_USERS = [
  { username: "alice", displayName: "Alice Chen" },
  { username: "bob", displayName: "Bob Martinez" },
  { username: "carol", displayName: "Carol Singh" },
];

/** Seeds demo accounts and one sample document the first time the DB is created. */
function seed(db: Db) {
  const count = db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number };
  if (count.n > 0) return;

  const insertUser = db.prepare("INSERT INTO users (id, username, display_name) VALUES (?, ?, ?)");
  for (const u of SEED_USERS) insertUser.run(`usr_${u.username}`, u.username, u.displayName);

  const now = new Date().toISOString();
  const docId = randomUUID();
  db.prepare(
    `INSERT INTO documents (id, title, content_html, owner_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    docId,
    "Welcome to Ajaia Docs",
    "<h1>Welcome to Ajaia Docs</h1>" +
      "<p>This document is owned by <strong>Alice</strong>. It is shared with <em>Bob</em> (can edit) and <u>Carol</u> (view only).</p>" +
      "<h2>Try it out</h2>" +
      "<ul><li>Format text with the toolbar</li><li>Rename the document at the top</li><li>Import a .txt or .md file from the dashboard</li></ul>",
    "usr_alice",
    now,
    now,
  );
  const insertShare = db.prepare(
    "INSERT INTO document_shares (document_id, user_id, role, created_at) VALUES (?, ?, ?, ?)",
  );
  insertShare.run(docId, "usr_bob", "editor", now);
  insertShare.run(docId, "usr_carol", "viewer", now);
}
