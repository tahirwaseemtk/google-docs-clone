# Ajaia Docs

A lightweight collaborative document editor built with Next.js (App Router), TypeScript, and SQLite.
Users can create, rename, edit, and format documents, import `.txt` / `.md` files, and share documents with teammates.

## Features

- **Create and rename** documents from the dashboard and the editor header.
- **Rich text editing** with bold, italic, underline, Heading 1–3, normal text, bulleted lists, and numbered lists. Keyboard shortcuts (Ctrl+B / I / U) work.
- **Autosave**: edits save about 0.7 s after you stop typing. The header shows "Unsaved changes", "Saving…", or "All changes saved". Changes also flush when the tab closes.
- **Import** a `.txt` or `.md` file as a new document. Markdown headings, lists, and emphasis are converted. Limit: **1 MB**. Other file types are rejected with a clear message.
- **Sharing**: the owner shares a document with another user as **Can edit** or **View only**, changes the role, or removes access. Viewers get a read-only editor. Users without access get a 404 (the document's existence is not revealed).
- **Owned vs. shared**: the dashboard lists "My documents" and "Shared with me" separately, with role badges.
- **Persistence**: documents, shares, and users are stored in SQLite and survive refresh and restart.

## Quick start (local)

Requirements: **Node.js 20.9+** (tested on Node 22.14) and npm.

```bash
npm install
npm run dev          # http://localhost:3000
```

Open http://localhost:3000 and pick a demo account on the sign-in screen. No password is needed.

| Account | Name | Sample access |
| --- | --- | --- |
| `alice` | Alice Chen | Owns "Welcome to Ajaia Docs" |
| `bob` | Bob Martinez | Can edit "Welcome to Ajaia Docs" |
| `carol` | Carol Singh | View only on "Welcome to Ajaia Docs" |

To see sharing in action: sign in as Alice, open the Welcome document, click **Share**, and grant access to another account. Then sign in as that account to see it under "Shared with me".

### Other scripts

```bash
npm test             # unit and integration tests (Vitest)
npm run typecheck    # TypeScript check without emitting files
npm run build        # production build
npm start            # run the production build (after npm run build)
```

### Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATA_FILE` | `./data/app.db` | Path to the SQLite database file. Put this on a persistent disk in production. |

The database and its seed data are created automatically on first run. To reset, stop the server and delete the `data/` folder.

## Deployment

The app needs a **long-running Node server with a persistent disk**, because SQLite is a file. Serverless platforms with ephemeral filesystems (such as Vercel's default functions) will lose data between requests.

Suggested path: **Render** (or Railway / Fly.io) as a Node web service.

1. Build command: `npm install && npm run build`
2. Start command: `npm start`
3. Set `DATA_FILE=/var/data/app.db` and attach a persistent disk mounted at `/var/data`.

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
    db.ts                     SQLite connection, migrations, seed data
    store.ts                  Document, sharing, and access rules (the only place they live)
    content.ts                HTML sanitization, Markdown and text conversion
    validation.ts             Zod schemas and upload limits
    http.ts                   Session helpers and error-to-response mapping
    api-client.ts             Fetch wrapper for the browser
    types.ts                  Types shared by client and server
tests/
  store.test.ts               Access control, sharing, persistence
  content.test.ts             Sanitization and import conversion
```

See `ARCHITECTURE.md` for design decisions and `AI_WORKFLOW.md` for how AI tools were used.

## Known limitations

- **Authentication is mocked.** The session cookie holds a user id and is not signed. This is fine for a demo, but not for production. A real version would use a signed session or an identity provider.
- **Single-writer conflict handling.** Two people editing the same document at the same time will overwrite each other (last save wins). There is no real-time sync or operational transform.
- **Import is limited** to `.txt` and `.md`. `.docx` was out of scope for the timebox.
- **No version history, comments, or folders.**
- Rich text uses `document.execCommand`, which browsers mark as legacy. It works in all current major browsers and keeps the dependency count low; see `ARCHITECTURE.md`.
