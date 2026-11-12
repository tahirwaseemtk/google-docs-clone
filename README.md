# Ajaia Docs

A lightweight collaborative document editor built with Next.js (App Router), TypeScript, and a libSQL database (Turso in production, a local SQLite file in development).
Users can create, rename, edit, and format documents, import `.txt` / `.md` files, and share documents with teammates.

## Features

- **Create and rename** documents from the dashboard and the editor header.
- **Rich text editing** with bold, italic, underline, Heading 1–3, normal text, bulleted lists, and numbered lists. Keyboard shortcuts (Ctrl+B / I / U) work.
- **Autosave**: edits save about 0.7 s after you stop typing. The header shows "Unsaved changes", "Saving…", or "All changes saved". Changes also flush when the tab closes.
- **Import** a `.txt` or `.md` file as a new document. Markdown headings, lists, and emphasis are converted. Limit: **1 MB**. Other file types are rejected with a clear message.
- **Sharing**: the owner shares a document with another user as **Can edit** or **View only**, changes the role, or removes access. Viewers get a read-only editor. Users without access get a 404 (the document's existence is not revealed).
- **Owned vs. shared**: the dashboard lists "My documents" and "Shared with me" separately, with role badges.
- **Persistence**: documents, shares, and users are stored in a database and survive refresh, restart, and redeploy.

## Quick start (local)

Requirements: **Node.js 20.9+** (tested on Node 22.14) and npm.

```bash
npm install
npm run dev          # http://localhost:3000
```

Locally, with no Turso settings, the app stores data in `data/app.db` (a SQLite file). Open http://localhost:3000 and pick a demo account on the sign-in screen. No password is needed.

| Account | Name | Sample access |
| --- | --- | --- |
| `alice` | Alice Chen | Owns "Welcome to Ajaia Docs" |
| `bob` | Bob Martinez | Can edit "Welcome to Ajaia Docs" |
| `carol` | Carol Singh | View only on "Welcome to Ajaia Docs" |

To see sharing in action: sign in as Alice, open the Welcome document, click **Share**, and grant access to another account. Then sign in as that account to see it under "Shared with me".

### Other scripts

```bash
npm test             # unit and integration tests (Vitest, 17 tests)
npm run typecheck    # TypeScript check without emitting files
npm run build        # production build
npm start            # run the production build (after npm run build)
```

### Configuration

| Variable | Required | Purpose |
| --- | --- | --- |
| `TURSO_DATABASE_URL` | Production | Turso database URL, for example `libsql://<name>-<org>.turso.io`. If unset, the app uses the local file `data/app.db`. |
| `TURSO_AUTH_TOKEN` | Production | Turso database token with read and write access. Keep it secret. |

The tables and demo data are created automatically on first start. To reset a local database, stop the server and delete the `data/` folder.

## Deployment (Vercel + Turso)

Vercel runs the app as serverless functions, which can't keep a SQLite file. The data lives in a hosted Turso database instead.

1. **Create a Turso database** at turso.tech. Copy its URL, and create a database token with read and write access.
2. **Push this repository** to GitHub.
3. **Import the repo in Vercel**: *Add New → Project*, select the repository. Keep the default Next.js settings (build command `next build`, output handled automatically).
4. **Add environment variables** in Vercel (*Settings → Environment Variables*): `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`.
5. **Deploy.** Vercel gives you a `*.vercel.app` URL. Open it and sign in as a demo account to confirm the data loads.

If you ever paste a token into a chat or commit it by mistake, rotate it in Turso and update the Vercel variable. Tokens are never stored in the repository.

## Supported file types and limits

| Item | Limit |
| --- | --- |
| Import types | `.txt`, `.md` |
| Import size | 1 MB |
| Document content | 500,000 characters of HTML |
| Document title | 200 characters |

## Project layout

```
src/
  app/
    page.tsx                  Dashboard (owned / shared lists, create, import)
    login/page.tsx            Demo account sign-in
    docs/[id]/page.tsx        Editor page (wraps the client editor)
    api/                      Route handlers (JSON API)
  components/
    document-editor.tsx       Editor, toolbar, autosave, share panel
  lib/
    db.ts                     Database connection (Turso or local file), migrations, seed data
    store.ts                  Document, sharing, and access rules (the only place they live)
    content.ts                HTML sanitization, Markdown and text conversion
    validation.ts             Zod schemas and upload limits
    http.ts                   Session helpers and error-to-response mapping
    api-client.ts             Fetch wrapper for the browser
    types.ts                  Types shared by client and server
tests/
  store.test.ts               Access control, sharing, persistence, delete cleanup
  content.test.ts             Sanitization and import conversion
```

See `ARCHITECTURE.md` for design decisions and `AI_WORKFLOW.md` for how AI tools were used.

## Known limitations

- **Authentication is mocked.** The session cookie holds a user id and is not signed. This is fine for a demo, but not for production. A real version would use a signed session or an identity provider.
- **Single-writer conflict handling.** Two people editing the same document at the same time will overwrite each other (last save wins). There is no real-time sync or operational transform.
- **Import is limited** to `.txt` and `.md`. `.docx` was out of scope for the timebox.
- **No version history, comments, or folders.**
- Rich text uses `document.execCommand`, which browsers mark as legacy. It works in all current major browsers and keeps the dependency count low; see `ARCHITECTURE.md`.
