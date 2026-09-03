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

| Phase                                                                                         | State                        | Commits                                                |
| --------------------------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------ |
| 0 tooling + safety net                                                                        | done                         | `f42d3d3`, `f9c76ed`                                   |
| rename restaurant→outlet                                                                      | done                         | `f5fc3af` + `docs/migrate-outlet-rename.sql`           |
| main syncs (×3)                                                                               | done                         | `2e2f0eb`, `bce98d2`, `4579f98` — main is at `001f0dc` |
| 1 monorepo scaffold                                                                           | done                         | `d06df02`                                              |
| 2 api foundation (auth plugin, repos, shared services, pglite harness)                        | done                         | `6efe5aa`                                              |
| 2 route ports: customer (session, order, bill, reward, waiter-call, anna, voice)              | done                         | `e617338`                                              |
| 2 route ports: staff (kitchen, waiter, tips, floor, counter)                                  | done                         | `67d3cf5`                                              |
| 2 route ports: admin (categories, login, me, menu, orders, settings, staff, tables, image)    | done                         | `67d3cf5`                                              |
| 2 wire-up/shared settle + cleanup                                                             | done                         | `a47172b`                                              |
| 3 tests                                                                                       | done — 75 files / 532 passed | `e617338`, `67d3cf5`, `a47172b`                        |
| 4 web batch 1: shell, router, RequireRole, login, kitchen, floor                              | done                         | `6b1a1d3`, `eac2649`                                   |
| 4 web batch 2: waiter, counter, admin pages                                                   | done                         | `bc8ed7f`                                              |
| 4 web batch 3: customer flow (`/t/:code` OrderExperience split, `/bill/:session`)             | done                         | `27b4c34`                                              |
| schema: `docs/migrate-live-columns.sql` for ~25 columns the live DB has but schema.sql lacked | done                         | `6bdc093`                                              |

All committed work above has the required gates green.

## Next (in order)

1. **Align customer UX with agentmemory decisions**: no visible chat transcript or language switcher; ordering is voice or manual menu. Display a stable UUID-derived KOT token across confirmation, session/order status, and kitchen views. No DB migration unless sequential human-readable tokens are later required.
2. **Delete `web/`**: remove the legacy workspace and its root `package.json`, `knip.json`, `vitest.config.ts`, lint-staged, and CI references; move any last pure helper needed by `apps/web` into `packages/shared`. Keep the root dev command usable for api + web.
3. **Rewrite `README.md`** for the new stack: env, SQL order, `npm run dev:api` (3001), `npm run dev:web` (5173), production `WEB_DIST`, and the real repo layout.
4. **Live smoke test** with a real `DATABASE_URL`: customer order, kitchen, waiter call, bill/settlement, admin menu edit, and photo upload; fix parity issues and add the Playwright coverage. Add Playwright directly only if the existing tooling cannot run the flows.
5. **Sync main once more** before opening the PR; after merge, new work lands on the new stack only.
6. **Deferred (Phase 5)**: Dockerfile/Railway, pino request IDs, helmet, Supabase RLS review, and Redis rate limiting for multi-instance deployment.

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
