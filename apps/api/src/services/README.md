# Layers

- **Controllers** (`src/routes/**`) validate input, call exactly one service, and map the result to HTTP. No SQL, no rules.
- **Services** (`src/services/**`) hold the rules. Style: a plain exported `async function` whose FIRST parameter is the repos it needs, typed `Pick<Repos, "sessions" | "outlets">` — never the whole `Repos`, so the dependency is visible in the signature. Services throw `HttpError` from `src/lib/http.ts` (`notFound`/`conflict`/`badRequest`) instead of returning `{error, status}`; the app error handler renders it.
- **Repositories** (`src/repositories/**`) are the only place Kysely appears. One module per table, exporting `makeXRepo(db)` — a factory returning plain functions, no classes and no interfaces. Add functions there rather than writing a query in a service.

Get repos from `app.repos` (decorated in `app.ts`); tests pass fakes via `buildApp({ repos })` or straight into a service.
