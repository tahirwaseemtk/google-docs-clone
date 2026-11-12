# AI Workflow Note

Written for: the assessment reviewers. Drafted with Claude Code; the candidate should review it before submission.

## Tools used

- **Claude Code** (CLI, Claude Haiku 5.5) for planning, scaffolding, writing most application code, writing tests, and drafting these docs.
- **Next.js bundled docs** (`node_modules/next/dist/docs/`), read directly from the installed version. The project's `AGENTS.md` points to them. I read the route-handler and dynamic-route guides before writing API code, because this Next.js version has breaking changes (for example, `params` is now a Promise).
- **npm, curl, and the TypeScript compiler** as verification tools, run by the AI and by hand.

## Where AI materially sped things up

- **Scaffolding and boilerplate.** Project setup, route-handler wiring, and Zod schemas came together quickly.
- **Consistent structure across surfaces.** Keeping the access rules in one service module and the routes thin was easier to hold consistent with AI help.
- **Diagnosing install and build issues.** The `create-next-app` name error (capitals and spaces in the folder name) and an ERESOLVE peer conflict between `vitest` and `@types/node` were resolved in a few iterations. The fix was to align `@types/node` to version 22, which matches the local Node runtime.
- **Changing the storage layer.** Moving from a local SQLite file to Turso meant changing the driver, making the service layer async, and updating routes and tests. Doing this by hand would have been error-prone. The change touched every route and the whole service layer, so the test suite and typecheck were the safety net: all 17 tests and the typecheck passed after the change, and the curl checks against Turso confirmed the behavior end to end.
- **Writing test cases** for the access matrix, which is repetitive but important to cover completely.

## What I changed or rejected

- **Scaffold config.** The generated `next.config.ts` enabled `cacheComponents` and `partialPrefetching`. I removed them because the app fetches data client-side, and they add caching behavior I did not need to reason about in the timebox. I added `serverExternalPackages` for the native SQLite module, which I later removed along with `better-sqlite3`.
- **Generated layout type.** The scaffold used the global `LayoutProps` type, which only exists after a build, so a standalone `tsc` failed. I replaced it with an explicit props type.
- **A test I got wrong.** A test expected Bob to have exactly one shared document. He also has the seeded sample, so the assertion was too strict. I changed it to look up the specific document. The app was right and the test was wrong.
- **Deletion relying on cascades.** The first version relied on foreign-key cascades to delete share rows. Foreign-key enforcement is per connection, so I changed delete to remove shares explicitly in the same batch and added a test for it.
- **Overly broad first drafts.** Early plans included a full auth flow and several file types. I cut them to keep the timebox for the core sharing and persistence, and documented the cuts.
- **Hosting plan.** My first plan was Render with a persistent disk. When the user asked about Vercel, I checked whether the design could run there. It couldn't with a file database, so I moved storage to Turso. I did not try to hide the constraint from the design docs.

## How I verified correctness, UX, and reliability

- **Automated tests (17, all passing).** `npm test` covers the access matrix (owner, editor, viewer, no access), revocation, sharing rules, delete cleanup, sanitization of scripts and attributes, Markdown and text import, and persistence after reload. Tests run the real service layer against an in-memory libSQL database.
- **Typecheck and production build.** `npm run typecheck` and `npm run build` both pass, and every route appears in the build output.
- **End-to-end API checks with curl** against the production server, run twice: once against a local file and once against the real Turso database. Checks covered login, create, edit, share as viewer, revoked access (404), and the database returning the expected rows after a reload.
- **Credential handling.** The database token was passed to test runs as an environment variable only. It was not written to any file. The first token I was given was rejected by Turso with HTTP 401 and was replaced by a working one.
- **Not verified:** I did not run an automated browser test or review the UI in a real browser. Toolbar behavior, caret handling, and mobile layout are checked by reading the code, not by use. This is the first thing I would do with more time, and the main UX risk to check during review.
- **Not yet verified:** the live Vercel deployment and the walkthrough video, which the submission requires.

## Judgment calls the AI did not make for me

- Which features to cut in favor of depth on sharing and persistence.
- Choosing a hosted database over a file database once Vercel was the target, and accepting Turso as a dependency.
- Keeping `execCommand` for rich text instead of adding an editor library, and documenting the tradeoff.
- Returning 404 instead of 403 for users without access, to avoid leaking document existence.
