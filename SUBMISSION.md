# Submission Contents

## Included

| Path | Description |
| --- | --- |
| `src/` | Application source: pages, API route handlers, components, service layer, and utilities |
| `tests/` | Automated tests (Vitest, 17 passing): access control, sharing, persistence, delete cleanup, sanitization, import |
| `public/` | Static assets from the Next.js scaffold |
| `README.md` | Local setup, run, test, and Vercel + Turso deployment instructions |
| `ARCHITECTURE.md` | Architecture note: priorities, data model, access model, tradeoffs |
| `AI_WORKFLOW.md` | AI workflow note: tools used, what was changed or rejected, verification |
| `SUBMISSION.md` | This file |
| `package.json`, `package-lock.json` | Dependencies and scripts (`dev`, `build`, `start`, `test`, `typecheck`) |
| `next.config.ts`, `tsconfig.json`, `vitest.config.ts` | Framework and test configuration |
| `.gitignore` | Excludes `node_modules`, build output, local `data/` database, and `.env` files |

## Not included in the repository

| Item | Status |
| --- | --- |
| Git push to GitHub | **Pending.** The local commit `cd4271d` (Turso storage change) needs `git push origin main` from a terminal with GitHub sign-in. |
| Live product URL (Vercel) | **Pending.** Deploy per `README.md` and paste the `*.vercel.app` URL here. |
| Walkthrough video URL | **Pending.** Record a short walkthrough and paste the URL here. |
| Screenshots or demo GIF | **Pending.** Recommended: dashboard, editor with formatting, share panel, and the viewer read-only view. |

## Live URL

Pending Vercel deployment.

## Walkthrough video

Pending recording.

## Suggested walkthrough (about 3 minutes)

1. Sign in as Alice; open "Welcome to Ajaia Docs"; apply formatting; watch the save status.
2. Create a new document and rename it.
3. Import a `.md` file from the dashboard and show that headings and lists convert.
4. Share the document with Bob (can edit). Sign in as Bob and show it under "Shared with me".
5. Sign in as Carol; open the welcome document; show that the editor is read-only.
6. Try to upload an unsupported file type to show the clear error message.
