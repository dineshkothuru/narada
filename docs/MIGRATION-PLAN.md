# Narada production restructure — plan and handoff

Branch: `ugudlado/restructure-api-server-layers` (worktree `.workspaces/narada/char`).
Last updated: 2026-09-04. Update the **Status** and **Next** sections at every handoff.
Semantic origin/main parity watermark: `ab4d484`.

## Target shape

```
apps/api          Fastify 5 + Kysely (Postgres via DATABASE_URL) — controllers / services / repositories
apps/web          Vite 7 + React 19 + React Router 7 + Tailwind 4 + shadcn — TanStack Query hooks over one API client
packages/shared   pure modules (i18n, format, types, billing-math, settle-math, status, tips, cart, games) + zod schemas
docs/             SQL schema + migrations, this plan
```

The former legacy `web/` app is removed after the SPA/API port; its route
contracts remain in the parity notes.

Rules that every agent/session must keep:

- **Layers (api)**: controllers validate with the shared zod schema, call exactly one service, map to HTTP. Services take `Pick<Repos, …>` as first parameter and throw `HttpError` (`src/lib/http.ts`). Repositories are the only place Kysely appears; one module per table, `makeXRepo(db)` factories, no classes/interfaces/DI. See `apps/api/src/services/README.md`.
- **Data access (web)**: components and pages import hooks from `src/api/hooks/*` only; never `src/api/client.ts` (eslint `no-restricted-imports` enforces). Query keys in `src/api/keys.ts`. Polling = `refetchInterval`, mutations invalidate keys.
- **Routes keep their legacy paths, JSON shapes and status codes** (`/api/...`), except intentionally removed unused compatibility routes: `/api/anna` and the legacy staff login APIs (`/api/auth/outlets`, `/api/auth/staff/login`, `/api/admin/login`). The current staff login is `/api/outlet/:slug/login`; parity notes live in `apps/api/tests/routes/PARITY*.md`.
- **Tenant is `outlet`** (`outlets`, `outlet_id`, `outletId`, `outletName`, `Outlet*`). Main branch still says `restaurant`; every sync re-applies the rename.
- **AI keys**: OpenRouter and Sarvam use server environment keys for now. Defer
  owner-supplied per-outlet keys until their security and administration model is defined.
- Tests: vitest at root (`pnpm test`), two projects (node for api/shared, jsdom for apps/web). Repository tests run against real Postgres via pglite loading `docs/schema.sql`.
- Tooling gates, all must exit 0 before a commit is "done": `pnpm run format:check`, `pnpm run lint`, `pnpm run typecheck`, `pnpm test`, `pnpm run knip`.
- Working model: Fable session = architect/planner/orchestrator; first consult recent `agentmemory` (recall/smart-search) for prior decisions + gotchas, then delegate execution to Sonnet subagents (Opus only for conflict-laden merges / large splits). Prefer routing: plan/spec with the highest-capability model available (you mentioned Grok 4.6) and execute concrete edits with smaller model subagents (you mentioned Composer). One agent per file-ownership area; shared small files are append-only.

## Status

| Phase                                                                                         | State                                       | Commits                                      |
| --------------------------------------------------------------------------------------------- | ------------------------------------------- | -------------------------------------------- |
| 0 tooling + safety net                                                                        | done                                        | `f42d3d3`, `f9c76ed`                         |
| rename restaurant→outlet                                                                      | done                                        | `f5fc3af` + `docs/migrate-outlet-rename.sql` |
| origin/main semantic parity watermark                                                         | `ab4d484`; ancestry merge complete          | merge commit `b4cae51`                       |
| 1 monorepo scaffold                                                                           | done                                        | `d06df02`                                    |
| 2 api foundation (auth plugin, repos, shared services, pglite harness)                        | done                                        | `6efe5aa`                                    |
| 2 route ports: customer (session, order, bill, reward, waiter-call, voice)                    | done                                        | `e617338`                                    |
| 2 route ports: staff (kitchen, waiter, tips, floor, counter)                                  | done                                        | `67d3cf5`                                    |
| 2 route ports: admin (categories, login, me, menu, orders, settings, staff, tables, image)    | done                                        | `67d3cf5`                                    |
| 2 wire-up/shared settle + cleanup                                                             | done                                        | `a47172b`                                    |
| 3 tests                                                                                       | done — 93 files / 535 tests passed          | `e617338`, `67d3cf5`, `a47172b`, `177bf51`   |
| 4 web batch 1: shell, router, RequireRole, login, kitchen, floor                              | done                                        | `6b1a1d3`, `eac2649`                         |
| 4 web batch 2: waiter, counter, admin pages                                                   | done                                        | `bc8ed7f`                                    |
| 4 web batch 3: customer flow (`/t/:code` OrderExperience split, `/bill/:session`)             | done                                        | `27b4c34`                                    |
| schema: `docs/migrate-live-columns.sql` for ~25 columns the live DB has but schema.sql lacked | done                                        | `6bdc093`                                    |
| 4 customer UX/KOT alignment                                                                   | done                                        | `177bf51`                                    |
| legacy `web/` deletion and pnpm/Vite/Fastify docs                                             | implemented locally                         | pending commit                               |
| outlet-scoped staff identity/auth revamp                                                      | implemented locally                         | pending commit                               |
| Phase 5 deployment/security docs and migrations                                               | implemented locally; external gates pending | pending commit                               |

The unused public `/api/anna` compatibility route was removed. Browser text and voice turns use
`/api/voice`; the future WhatsApp channel will use its dedicated webhook and shared agent service.

The staff/outlet revamp is implemented and verified in the worktree: the sole
staff login form is `/outlet/:slug/login`, with lowercase usernames, required
first name, optional last name, server-derived roles, outlet-scoped v3 sessions,
active-account revalidation, admin enrollment, and self-service password
changes. There is no shared chooser or legacy role-login route; role-specific
signup URLs remain admin-protected. The editable Settings slug is normalized to
lowercase, validated as 3–63 characters with single hyphens, and protected by
database uniqueness with HTTP 409 feedback; old public URLs stop working
immediately after a slug change.

All migration phases are implemented locally. The local `narada_dev` migration,
seed, repeat-migration pass, and RLS checks pass. Browser checks cover customer
signup/login, takeaway and table ordering, all five seeded role logins, signup
fields, and the Settings slug UI. Final pnpm gates pass: 93 files / 535 tests,
typecheck, lint (8 warnings, 0 errors), format, knip, and production build.
The semantic origin/main watermark remains `ab4d484`; relevant UI semantics are
merged at `b4cae51`.

The password-auth migration preserves legacy rows and their display name as
`first_name`, removes the legacy PIN columns, and leaves incomplete identity
rows unavailable for login. Complete each remaining row in Admin > Users; the
existing SQL demo-account migration remains authoritative for demo accounts.

## Next (external gates)

1. **Apply the auth and tenant migrations to an existing database**: take a backup, run the migrations in the README order, then complete legacy staff setup in Admin > Users.
2. **Run live smoke tests** with a real `DATABASE_URL`: customer order, kitchen, waiter call, bill/settlement, admin menu edit, photo upload, and slug changes. Verify Railway, Redis, and production-browser/security behavior.

## Follow-up: customer and outlet login

### Staff/outlet design — verified

`/outlet/:slug/login` is the sole staff entry point. The URL selects the outlet
and the form submits `{ username, password }`; there is no outlet chooser or
role selector. A username is canonical lowercase ASCII, 3–32 characters from
`a-z`, `0-9`, `.`, `_`, or `-`; uniqueness is per outlet. First name is required
display data (1–60 characters after trimming), and last name is optional (at
most 60 characters after trimming).

The server resolves an active staff row within the selected outlet, verifies
the password, and derives the role from that row. It returns the stored staff
and outlet identity and issues the `narada_staff` v3 cookie. Signed claims carry
`staffId`, `outletId`, role, and expiry; protected requests reload the active
staff and outlet and require the stored outlet/role to match. All protected data
access uses the authenticated `outletId`, never an outlet supplied by a client.

Invalid username or password combinations return the same error.
Inactive outlets and staff accounts cannot sign in. The login form has no role
selector. Successful login redirects by stored role. The local demo URLs and
seeded credentials are maintained in
[`docs/DEMO-CREDENTIALS.md`](DEMO-CREDENTIALS.md), rather than duplicated in
this plan.

Admin-protected staff creation remains available at `/admin/signup`,
`/kitchen/signup`, `/waiter/signup`, `/floor/signup`, and `/counter/signup`; the
route fixes the new account's role. Admins can enroll or edit incomplete legacy
rows in Admin > Users. Signed-in staff can change their own password through
`PATCH /api/auth/staff/password`.

The seeded outlet and customer account, along with each role's local login,
signup, and destination details, are documented in
[`docs/DEMO-CREDENTIALS.md`](DEMO-CREDENTIALS.md).

### Customer login — phone-only, complete

`/login` and `/signup` use an international phone number plus password. The
API persists customer accounts separately from staff, issues an HTTP-only
customer account cookie, and supports account lookup, logout, and password
changes. Customer ordering remains guest-capable; email is deferred until its
verification and persistence rules are defined.

### Acceptance status

- [x] `/outlet/:slug/login` selects the outlet from the URL and asks only for
      username/password; no shared chooser remains.
- [x] Usernames are lowercase and unique within an outlet, so the same username
      can exist in different outlets.
- [x] The server derives role and scopes the v3 session and protected data to
      the authenticated outlet.
- [x] Invalid credentials, inactive accounts, and session role/outlet mismatch
      do not grant access or reveal which credential was wrong.
- [x] Legacy role-specific login URLs and the shared `/outlet/login` route are
      removed; unauthenticated protected routes and logout return to `/`.
- [x] Role-specific signup URLs are admin-protected; first name is required and
      last name is optional.
- [x] Customer signup/login uses phone + password and issues a separate customer
      account cookie; email is explicitly deferred.
- [x] Complete pnpm gates, local migration/reseed, and browser verification.

### Decisions

- Selected: one outlet-staff form and a separate customer phone/password entry point.
- Selected: username is the login identifier; names are display data only.
- Rejected: one staff login form per role, because role must be server-derived.
- Selected: phone-only customer identity now; email later after verification rules are defined.
- Selected: staff username + password, not PIN; first name required, last name optional.

## Outlet URLs and tableless ordering — implemented locally

Make the outlet the required ordering boundary and the table an optional
dine-in context:

- `/outlet/:slug` opens the outlet ordering flow and starts takeaway ordering
  by default.
- `/outlet/:slug/table/:tableCode` opens dine-in ordering. The server must
  verify that the table belongs to the outlet identified by `slug`.
- `/outlet/:slug/login` is the staff login URL for that outlet. The URL selects
  the outlet, so the form asks only for username and password and the server
  still derives the role from the account.

There is no shared login page or legacy role-login entry point. The home page
links to the seeded outlet's scoped login URL.

Add an outlet-level `tables_enabled` setting. Takeaway remains available for
every outlet; when `tables_enabled` is false, table routes reject access and
the base outlet URL is the only ordering entry point. When it is true, both
takeaway and table-specific ordering are available.

Generalize customer sessions so `outlet_id` is always required, `table_id` is
nullable, and `service_type` distinguishes `dine_in` from `takeaway`. Creating
either kind of session must issue a signed customer-session capability bound
to its session and outlet. Subsequent order and bill requests authorize with
that capability instead of treating a table code or bare session UUID as
customer authentication.

### Phase implementation status

- [x] Add `tables_enabled` to outlets and backfill existing outlets that have
      tables; enable it for the demo outlet.
- [x] Add `service_type` to customer sessions and make `table_id` nullable for
      takeaway sessions.
- [x] Build `/outlet/:slug`, `/outlet/:slug/login`, and
      `/outlet/:slug/table/:tableCode`, including outlet/table ownership checks
      and removal of the login form's outlet dropdown.
- [x] Add an admin Settings slug editor with lowercase 3–63 character,
      single-hyphen validation, database uniqueness, HTTP 409 duplicate
      feedback, and immediate invalidation of old public URLs after changes.
- [x] Issue and validate the signed customer-session capability for order and
      bill access in both flows.
- [x] Add migration, route, tenant-isolation, table-disabled, takeaway, and
      customer-auth tests. Local browser verification is complete; production
      browser verification remains an external gate.

Assumption: table-enabled outlets still permit takeaway ordering. Delivery is
not part of this phase; add another service type only when its fulfillment
requirements are defined.

## Gotchas collected so far

- `pnpm install` may fail inside the Claude sandbox when its store is outside the workspace; run it with the sandbox disabled if needed.
- `env.ts` snapshots `process.env` at import — tests set env in root `vitest.config.ts` `test.env`, or mutate the imported `env` object.
- pg/pglite return numeric columns as strings — `Number()` them.
- `kysely-pglite` pulls an older kysely and breaks typecheck; the 40-line dialect in `apps/api/tests/helpers/pgliteDialect.ts` replaces it. Register `pgcrypto` on the PGlite constructor; strip RLS/grant/publication statements when loading schema.sql; `db.destroy()` already closes PGlite.
- `docs/migrate-i18n-columns.sql` only applies to pre-migration DBs (reads an `i18n` jsonb column a fresh schema never has).
- apps/web lints with its own eslint config (react-hooks plugin); root config ignores `apps/web/**`.
- Vite dev proxy `/api` → 3001; `/health` is also mounted at `/api/health` for it.
- Pre-commit hook (lint-staged) is installed into the main repo's `.git/hooks`, so it fires in every worktree.
- The git stash stack is shared across worktrees — never stash; use WIP commits.
