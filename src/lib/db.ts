import { createClient, type Client } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

export type Db = Client;

const globalForDb = globalThis as unknown as { __ajaiaDb?: Promise<Db> };

/**
 * Shared database connection for the running server (one per process).
 * Uses Turso when TURSO_DATABASE_URL is set (production), otherwise a local SQLite file (development).
 */
export function getDb(): Promise<Db> {
  if (!globalForDb.__ajaiaDb) globalForDb.__ajaiaDb = connect();
  return globalForDb.__ajaiaDb;
}

async function connect(): Promise<Db> {
  const remote = process.env.TURSO_DATABASE_URL;
  if (remote) return openDatabase(remote, process.env.TURSO_AUTH_TOKEN);

  const file = path.join(process.cwd(), "data", "app.db");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  return openDatabase(`file:${file}`);
}

/** Opens (and migrates + seeds) a database. Use ":memory:" in tests. */
export async function openDatabase(url: string, authToken?: string): Promise<Db> {
  const db = createClient({ url, authToken });
  await migrate(db);
  await seed(db);
  return db;
}

async function migrate(db: Db) {
  await db.executeMultiple(`
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
      document_id TEXT NOT NULL REFERENCES documents(id),
      user_id     TEXT NOT NULL REFERENCES users(id),
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

/** Seeds demo accounts and one sample document the first time the database is created. */
async function seed(db: Db) {
  const count = await db.execute("SELECT COUNT(*) AS n FROM users");
  if (Number(count.rows[0][0]) > 0) return;

  const now = new Date().toISOString();
  const docId = randomUUID();

  await db.batch(
    [
      ...SEED_USERS.map((u) => ({
        sql: "INSERT INTO users (id, username, display_name) VALUES (?, ?, ?)",
        args: [`usr_${u.username}`, u.username, u.displayName],
      })),
      {
        sql: `INSERT INTO documents (id, title, content_html, owner_id, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?)`,
        args: [
          docId,
          "Welcome to Ajaia Docs",
          "<h1>Welcome to Ajaia Docs</h1>" +
            "<p>This document is owned by <strong>Alice</strong>. It is shared with <em>Bob</em> (can edit) and <u>Carol</u> (view only).</p>" +
            "<h2>Try it out</h2>" +
            "<ul><li>Format text with the toolbar</li><li>Rename the document at the top</li><li>Import a .txt or .md file from the dashboard</li></ul>",
          "usr_alice",
          now,
          now,
        ],
      },
      {
        sql: "INSERT INTO document_shares (document_id, user_id, role, created_at) VALUES (?, ?, ?, ?)",
        args: [docId, "usr_bob", "editor", now],
      },
      {
        sql: "INSERT INTO document_shares (document_id, user_id, role, created_at) VALUES (?, ?, ?, ?)",
        args: [docId, "usr_carol", "viewer", now],
      },
    ],
    "write",
  );
}
