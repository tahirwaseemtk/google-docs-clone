# Architecture Note

## What I prioritized

The brief asked for a product that feels coherent across creation, editing, import, sharing, and persistence, with enough engineering quality to show judgment. I prioritized, in order:

1. **Correct sharing and access rules.** The most important part to get right. All access decisions live in one module (`src/lib/store.ts`) and are covered by tests.
2. **Data that survives refresh and redeploy.** Every edit is saved, content is sanitized on write, and data lives in a hosted database so it isn't tied to one server.
3. **A usable editing flow.** A familiar toolbar, autosave with visible status, and a read-only mode for viewers.
4. **Working file import** in a clearly limited form (`.txt`, `.md`, 1 MB).

I deliberately deprioritized real-time collaboration, version history, comments, and real authentication. Each would be a meaningful feature on its own, and none would strengthen the core story as much as correct sharing and reliable saving.

## Stack

| Layer | Choice | Why |
| --- | --- | --- |
| App framework | Next.js 16 (App Router), React 19, TypeScript | One repo for UI and API; route handlers keep the API close to the UI. |
| Hosting | Vercel | Native Next.js support, automatic deploys from GitHub. |
| Storage | Turso (hosted libSQL/SQLite) via `@libsql/client` | Serverless-friendly: no disk to manage, SQL with relational joins for owned/shared queries. Locally it falls back to a SQLite file with the same driver. |
| Validation | Zod | One schema per request body, with user-readable messages. |
| Content safety | `sanitize-html` (allowlist) | Stored HTML is restricted to the formatting the editor produces. |
| Markdown import | `marked` (then sanitized) | Standard parser; output is run through the same allowlist. |
| Tests | Vitest | Fast, TypeScript-native, runs the real service layer against an in-memory database. |

## Structure and data flow

```
Browser (client components)
   │  fetch JSON / multipart
   ▼
Route handlers  (src/app/api/**)      ← parse input (zod), read session cookie, map errors to HTTP
   │
   ▼
Service layer  (src/lib/store.ts)     ← all access rules and business logic
   │
   ▼
libSQL  (Turso in production, local file in development)
        users, documents, document_shares
```

Route handlers are thin: they parse, call one service function, and return. Errors are typed (`AppError` with a status) so the service layer decides the status code, and the route layer converts it to a response. This keeps the rules testable without HTTP.

### Data model

- `users(id, username, display_name)`: seeded demo accounts.
- `documents(id, title, content_html, owner_id, created_at, updated_at)`: content is stored as sanitized HTML. Ownership is a column on the document, not a share row.
- `document_shares(document_id, user_id, role, created_at)`: primary key `(document_id, user_id)`, so each person has at most one role per document. Role is `editor` or `viewer`; the owner is implicit.

Deleting a document removes its share rows in the same batch. The schema also declares foreign keys, but I don't rely on cascade behavior because foreign-key enforcement is a per-connection setting that a remote client doesn't guarantee.

### Access model

| Action | Owner | Editor | Viewer | No access |
| --- | --- | --- | --- | --- |
| Read | yes | yes | yes | 404 |
| Edit content / title | yes | yes | 403 | 404 |
| Share, change role, remove access | yes | 403 | 403 | 404 |
| Delete document | yes | 403 | 403 | 404 |

Returning 404 to users without access (rather than 403) avoids leaking that a document exists.

## Key decisions and tradeoffs

**Content is sanitized on write, not only on render.** The database never holds unsafe HTML, so any future client (mobile, export) inherits the guarantee. The allowlist is explicit and tested.

**Autosave with a serialized queue.** Edits are debounced (700 ms). Saves run one at a time through a promise chain, so an older request cannot overwrite a newer one. Failed saves are re-queued rather than dropped, and the header shows the error. A `keepalive` request runs on `pagehide` to catch the last edit.

**The editor surface owns its DOM.** The saved HTML is written into the contenteditable once, and React does not re-render its contents. Re-rendering would reset the caret while typing.

**Rich text uses `document.execCommand`.** It is deprecated, but it is supported in all current major browsers, needs no dependency, and covers the required formatting. The tradeoff is that output varies slightly by browser, which is why the sanitizer allows both `<b>`/`<strong>` and `<i>`/`<em>`. If this moved to production, I would replace it with a schema-based editor such as Tiptap or ProseMirror, which gives a structured document model and collaboration support.

**Hosted database instead of a file.** My first design used SQLite on a persistent disk. That works on a traditional server, but Vercel's serverless functions have no persistent disk, so the data would be lost. Moving to Turso keeps SQLite's model and SQL, and only changes the connection layer (`src/lib/db.ts`) and the service layer from synchronous to async calls. The local development path uses the same driver against a file, so there's one code path.

**Serverless-safe connection handling.** Each function instance opens one client and reuses it. Schema creation and demo seeding are idempotent (`CREATE TABLE IF NOT EXISTS`, and seeding only runs when the users table is empty), so a cold start can safely run them again.

**Mock authentication.** The brief allowed it. The session cookie holds the user id, unsigned, which is acceptable only for a demo. The cookie is `Secure` in production. The auth boundary is isolated in `src/lib/http.ts`, so swapping in a signed session or an identity provider touches one file.

**Import converts to the editor's own format.** Markdown and text are converted to the same allowlisted HTML the editor produces, so an imported file behaves like any other document.

## Known gaps

- No real-time collaboration; concurrent edits are last-save-wins.
- Mock auth, no rate limiting, no CSRF protection beyond `SameSite=Lax` cookies on JSON endpoints.
- No pagination on document lists (fine at this scale).
- Verified by unit tests, production build, and curl tests against both a local server and the Turso database. Browser UI behavior has not been tested in an automated browser.
