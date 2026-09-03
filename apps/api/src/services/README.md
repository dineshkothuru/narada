# Layers

- **Controllers** (`src/routes/**`) validate input, call exactly one service, and map the result to HTTP. No SQL, no rules.
- **Services** (`src/services/**`) hold the rules. Style: a plain exported `async function` whose FIRST parameter is the repos it needs, typed `Pick<Repos, "sessions" | "outlets">` — never the whole `Repos`, so the dependency is visible in the signature. Services throw `HttpError` from `src/lib/http.ts` (`notFound`/`conflict`/`badRequest`) instead of returning `{error, status}`; the app error handler renders it.
- **Repositories** (`src/repositories/**`) are the only place Kysely appears. One module per table, exporting `makeXRepo(db)` — a factory returning plain functions, no classes and no interfaces. Add functions there rather than writing a query in a service.

Get repos from `app.repos` (decorated in `app.ts`); tests pass fakes via `buildApp({ repos })` or straight into a service.

Two notes for the route agents:

- `generateBill(repos, sessionId)` takes NO tip. The counter raises a plain bill and `recordPayment` turns anything paid above it into the tip, via `splitPayment` in `src/lib/settle-math.ts` (a local copy of `web/lib/settle-math.ts`; it moves to `@narada/shared` at merge, so change only that one import).
- `services/storage.ts` is the only code still talking to Supabase, for dish photos in the `menu` bucket. It needs the optional `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; without them an upload fails with a clear 500. Its controller must parse `multipart/form-data`, which Fastify does not do out of the box — register `@fastify/multipart` when you build that route.
