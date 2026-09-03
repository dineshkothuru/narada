# Narada production restructure — plan and handoff

Branch: `ugudlado/restructure-api-server-layers` (worktree `.workspaces/narada/char`).
Last updated: 2026-09-03. Update the **Status** and **Next** sections at every handoff.

## Target shape

```
apps/api          Fastify 5 + Kysely (Postgres via DATABASE_URL) — controllers / services / repositories
apps/web          Vite 7 + React 19 + React Router 7 + Tailwind 4 + shadcn — TanStack Query hooks over one API client
packages/shared   pure modules (i18n, format, types, billing-math, settle-math, status, tips, cart, games) + zod schemas
docs/             SQL schema + migrations, this plan
web/              legacy Next.js app — source of truth for behaviour until deleted in Phase 4 step 6
```

Rules that every agent/session must keep:

- **Layers (api)**: controllers validate with the shared zod schema, call exactly one service, map to HTTP. Services take `Pick<Repos, …>` as first parameter and throw `HttpError` (`src/lib/http.ts`). Repositories are the only place Kysely appears; one module per table, `makeXRepo(db)` factories, no classes/interfaces/DI. See `apps/api/src/services/README.md`.
- **Data access (web)**: components and pages import hooks from `src/api/hooks/*` only; never `src/api/client.ts` (eslint `no-restricted-imports` enforces). Query keys in `src/api/keys.ts`. Polling = `refetchInterval`, mutations invalidate keys.
- **Routes keep their legacy paths, JSON shapes and status codes** (`/api/...`). The SPA was written against `web/app/api/**` contracts; parity notes live in `apps/api/tests/routes/PARITY*.md`.
- **Tenant is `outlet`** (`outlets`, `outlet_id`, `outletId`, `outletName`, `Outlet*`). Main branch still says `restaurant`; every sync re-applies the rename.
- **BYOK**: Gemini/Sarvam keys live per outlet in the DB with env fallback (`services/keys.ts`). Do not move to env-only.
- Tests: vitest at root (`npm test`), two projects (node for api/shared/web-legacy, jsdom for apps/web). Repository tests run against real Postgres via pglite loading `docs/schema.sql`.
- Tooling gates, all must exit 0 before a commit is "done": `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run knip`.
- Working model: Fable session = architect/orchestrator; Sonnet subagents implement, Opus for conflict-laden merges / large splits. One agent per file-ownership area; shared small files are append-only.

## Status

| Phase                                                                                         | State                                                                    | Commits                                                |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------ |
| 0 tooling + safety net                                                                        | done                                                                     | `f42d3d3`, `f9c76ed`                                   |
| rename restaurant→outlet                                                                      | done                                                                     | `f5fc3af` + `docs/migrate-outlet-rename.sql`           |
| main syncs (×3)                                                                               | done                                                                     | `2e2f0eb`, `bce98d2`, `4579f98` — main is at `001f0dc` |
| 1 monorepo scaffold                                                                           | done                                                                     | `d06df02`                                              |
| 2 api foundation (auth plugin, repos, shared services, pglite harness)                        | done                                                                     | `6efe5aa`                                              |
| 2 route ports: customer (session, order, bill, reward, waiter-call, anna, voice)              | in flight                                                                | —                                                      |
| 2 route ports: staff (kitchen, waiter, tips, floor, counter)                                  | in flight                                                                | —                                                      |
| 2 route ports: admin (categories, login, me, menu, orders, settings, staff, tables, image)    | in flight                                                                | —                                                      |
| 3 tests                                                                                       | interleaved with 2 (services w/ fakes, `inject` per route, pglite repos) | —                                                      |
| 4 web batch 1: shell, router, RequireRole, login, kitchen, floor                              | done                                                                     | `6b1a1d3`, `eac2649`                                   |
| 4 web batch 2: waiter, counter, admin pages                                                   | done                                                                     | `bc8ed7f`                                              |
| 4 web batch 3: customer flow (`/t/:code` OrderExperience split, `/bill/:session`)             | in flight                                                                | —                                                      |
| schema: `docs/migrate-live-columns.sql` for ~25 columns the live DB has but schema.sql lacked | in flight                                                                | —                                                      |

Uncommitted at handoff time (if the session ended mid-flight): check `git status`; agents were told never to commit. Commit per area after running the gates on that workspace.

## Next (in order)

1. **Land the in-flight work**: for each of customer/staff/admin routes, batch 3, schema migration — run the gates scoped to the workspace, fix, commit separately. Remove the remaining temporary knip ignores in `knip.json` (`zod` in api/shared, `lucide-react` in web) once wired.
2. **Wire-up check**: `apps/api/src/app.ts` must register every route plugin; `npm run dev:api` + curl each `/api/*` path with fake env boots without DB (routes fail only at query time). Switch `apps/api/src/services/settle.ts` to import `splitPayment` from `@narada/shared` and delete `apps/api/src/lib/settle-math.ts`.
3. **Delete `web/`**: `git rm -r web`, drop the `web` workspace from root `package.json`, `knip.json`, `vitest.config.ts`, `lint-staged` entries, `.github/workflows/ci.yml`; move any last pure helper the SPA still needed into `packages/shared`. Root `dev` script → concurrently run api + web (or document two terminals).
4. **README rewrite**: run instructions = `npm install`, env (`DATABASE_URL` Supabase pooler string session mode, `SESSION_SECRET`, optional `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` for photo uploads, optional `GEMINI_API_KEY`/`SARVAM_API_KEY`), SQL order (schema.sql for fresh; migrate-i18n-columns → migrate-outlet-rename → migrate-live-columns for existing), `npm run dev:api` (3001) + `npm run dev:web` (5173), prod = api serves `apps/web/dist` via `WEB_DIST`. Update the "Repo layout" section to the real tree.
5. **Live smoke test** (needs a real `DATABASE_URL` in `apps/api/.env`): scan `/t/t1-demo`, place an order, see it in `/kitchen`, call waiter, ask for bill, settle at `/counter`, admin login + menu edit + photo upload. Fix parity bugs found; add a Playwright spec for these three flows afterwards (Phase 3 tail).
6. **Sync main once more** before opening the PR; after the PR merges, new work lands on the new stack only.
7. **Deferred (Phase 5, not started)**: Dockerfile (multi-stage: build web, run api with `WEB_DIST`), Railway service, pino request ids, helmet, Supabase RLS review, Redis-backed rate limit if more than one instance.

## Gotchas collected so far

- `npm install` fails inside the Claude sandbox (EACCES on `~/.npm`); run it with the sandbox disabled.
- `env.ts` (both api and legacy web) snapshots `process.env` at import — tests set env in root `vitest.config.ts` `test.env`, or mutate the imported `env` object.
- pg/pglite return numeric columns as strings — `Number()` them.
- `kysely-pglite` pulls an older kysely and breaks typecheck; the 40-line dialect in `apps/api/tests/helpers/pgliteDialect.ts` replaces it. Register `pgcrypto` on the PGlite constructor; strip RLS/grant/publication statements when loading schema.sql; `db.destroy()` already closes PGlite.
- `docs/migrate-i18n-columns.sql` only applies to pre-migration DBs (reads an `i18n` jsonb column a fresh schema never has).
- apps/web lints with its own eslint config (react-hooks plugin); root config ignores `apps/web/**`.
- Vite dev proxy `/api` → 3001; `/health` is also mounted at `/api/health` for it.
- Pre-commit hook (lint-staged) is installed into the main repo's `.git/hooks`, so it fires in every worktree.
- The git stash stack is shared across worktrees — never stash; use WIP commits.
