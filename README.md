# Narada

Narada is a QR dine-in ordering app with a multilingual voice waiter. Customers
scan a table QR code, browse the menu, order in rounds, call a waiter, and pay
at the end of the visit. Staff use role-gated kitchen, waiter, floor, counter,
and admin screens.

## Stack

- `apps/api`: Fastify 5, Kysely, and PostgreSQL (`DATABASE_URL`)
- `apps/web`: Vite 7, React 19, React Router 7, Tailwind 4, and shadcn
- `packages/shared`: shared types, schemas, and pure business logic

The API serves the built SPA when `WEB_DIST` is set. Supabase is optional and
is used only for dish-photo storage; database access is through PostgreSQL.

## Local setup

Prerequisites: Node 22 and pnpm 11.

```bash
git clone https://github.com/<owner>/narada
cd narada
pnpm install
cp .env.example apps/api/.env
```

Set these required values in `apps/api/.env`:

```env
DATABASE_URL=postgres://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres
SESSION_SECRET=<long random string; openssl rand -hex 32>
```

`GEMINI_API_KEY` and `SARVAM_API_KEY` are optional environment fallbacks; the
admin settings screen can store per-outlet keys. `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` are needed only for dish-photo uploads.

For a one-time first-admin bootstrap, set `ADMIN_BOOTSTRAP_USERNAME`,
`ADMIN_BOOTSTRAP_FIRST_NAME`, and `ADMIN_BOOTSTRAP_PASSWORD`. The username must
be 3–32 lowercase ASCII letters, numbers, dots, underscores, or hyphens; the
password must be 15–128 characters. `ADMIN_BOOTSTRAP_LAST_NAME` is optional.
Set `ADMIN_BOOTSTRAP_OUTLET_SLUG` when more than one active outlet exists.
Bootstrap runs only when the target outlet has no usable active admin; remove
the bootstrap values after the account is available.

### Database

For a fresh database, run these files in this order in the SQL editor:

1. [`docs/schema.sql`](docs/schema.sql)
2. [`docs/seed.sql`](docs/seed.sql)
3. [`docs/seed-i18n.sql`](docs/seed-i18n.sql)

The demo seed creates the `Spice Garden` outlet, four table QR codes, and local
staff accounts. See [`docs/DEMO-CREDENTIALS.md`](docs/DEMO-CREDENTIALS.md) for
the local demo URLs and seeded credentials.

For a database created by the legacy `web/` app, do not rerun the fresh seed.
Apply the migrations in this order:

1. [`docs/migrate-i18n-columns.sql`](docs/migrate-i18n-columns.sql)
2. [`docs/migrate-outlet-rename.sql`](docs/migrate-outlet-rename.sql)
3. [`docs/migrate-live-columns.sql`](docs/migrate-live-columns.sql)
4. [`docs/migrate-password-auth.sql`](docs/migrate-password-auth.sql)
5. [`docs/migrate-customer-auth.sql`](docs/migrate-customer-auth.sql)
6. [`docs/migrate-outlet-ordering.sql`](docs/migrate-outlet-ordering.sql)
7. [`docs/migrate-main-product-parity.sql`](docs/migrate-main-product-parity.sql)
8. [`docs/migrate-api-only-rls.sql`](docs/migrate-api-only-rls.sql)

Take a database backup first. Fresh databases already contain these columns and
the outlet naming, so they do not need the migration files. The password-auth
migration preserves existing staff and outlet rows, copies a legacy display
name into `first_name`, and removes the legacy PIN columns. Legacy rows without
a username or password cannot sign in until an admin completes their setup in
Admin > Users. If no active admin can sign in, use the one-time bootstrap
variables above, start the API, remove those variables, then enroll the
remaining staff accounts.

## Run

Run the API and web app together:

```bash
pnpm dev
```

Or run them separately:

```bash
pnpm dev:api  # http://localhost:3001
pnpm dev:web  # http://localhost:5173
```

For local customer/staff demo URLs and seeded credentials, see
[`docs/DEMO-CREDENTIALS.md`](docs/DEMO-CREDENTIALS.md).

Staff sign in with a lowercase username and password. The form has no outlet
chooser or role selector: the URL selects the outlet and the server derives the
account's role, then redirects to that role's home. There is no shared or legacy
role-login route.

Signup URLs remain role-specific, admin-protected account-creation screens. They
require a lowercase username, first name, password, and an optional last name;
there is no public staff signup.

An admin can enroll and manage staff at
[`/admin/users`](http://localhost:5173/admin/users); the account-creation API is
`POST /api/admin/staff`. Signed-in staff can change their own password with
`PATCH /api/auth/staff/password` using `currentPassword` and `newPassword`.
Admin Settings includes an explicit Outlet URL slug editor. Slugs are
normalized to lowercase, must be 3–63 characters using letters, numbers, and
single hyphens (no leading, trailing, or consecutive hyphens), and are unique
in the database; a duplicate returns HTTP 409. Changing a slug invalidates its
old public URLs immediately.

## Production build

Build the SPA, then point the API at its output directory:

```bash
pnpm --filter @narada/web build
WEB_DIST="$PWD/apps/web/dist" pnpm --filter @narada/api start
```

The production API listens on port `3001` by default. Set `PORT` and `WEB_DIST`
in the API environment when deploying elsewhere.

Customer identity is phone-only for now; email can be added later. Staff use a
username and password (not PIN); first name is required and last name optional.
Text and voice turns use `/api/voice`; the old `/api/anna` route was removed.
`REDIS_URL` is optional for local single-instance development. For multi-instance
Railway deployment, set it so rate limits are shared across instances; otherwise
each instance has its own in-memory limits.
Leave `TRUST_PROXY_HOPS` empty locally; set it to `1` on Railway only after
confirming the service has one trusted edge proxy hop.
Railway can deploy from the root `Dockerfile`; set `DATABASE_URL` and
`SESSION_SECRET`. Railway supplies `PORT` and uses `/health`.
Live Railway, Redis, and production-browser verification remain deployment
gates rather than local checks.

## Checks

```bash
pnpm run format:check
pnpm run lint
pnpm run typecheck
pnpm test
pnpm run knip
```

## Repository layout

```text
apps/api/       Fastify API, services, repositories, and route tests
apps/web/       Vite customer and staff SPA
packages/shared Shared schemas, types, and pure modules
docs/           PostgreSQL schema, seeds, and migrations
```
