# Parity notes — admin routes

Source of truth: `web/app/api/admin/{categories,login,me,menu,orders,settings,staff,tables}/route.ts`
in this worktree, and `git show main:web/app/api/admin/image/route.ts` for the image route
(the image route does not exist in this worktree's `web/app/api/admin/`).

All 9 routes ported at the same paths, JSON shapes, and status codes, unless noted below.

## categories

- POST/DELETE identical. `POST` 400 on empty name, DELETE 400 without `id`.
- Delete-blocked-by-history path: legacy relies on a thrown Postgres FK error from
  `sbFetch`; the Kysely repo throws the same way on delete, caught identically, then
  `menu_items.hideByCategory` marks items unavailable and returns `{ok:false, reason}`
  with **200**, matching legacy (no status code change on that branch).

## login

- POST: PIN checked against `staff.pin` (active only) then `outlets.admin_pin`, both
  constant-time compared via `timingSafeEqual`, matching legacy exactly.
- Rate limit: `rateLimited(10)` on POST, same as legacy's `rateLimit(req, "login", 10)`
  (legacy returned 429 "too many attempts"; `@fastify/rate-limit`'s default 429 body
  differs in wording from legacy's custom message — flagging as a **minor known
  divergence**, not fixed here since the route README didn't call out exact 429 body
  parity and `@fastify/rate-limit` owns that response).
- Cookie set/cleared exactly per `plugins/auth.ts` `setRoleCookie`/`clearRoleCookie`
  (`secure` only in production), unchanged from legacy.
- `/api/admin/login` POST is exempt from the auth plugin's cookie gate (see
  `plugins/auth.ts` line checking `pathname === "/api/admin/login"`); DELETE is also
  reachable without a cookie in both legacy and this port (no auth required to log out).

## me

- Was already inline in `app.ts` from the foundation layer; moved verbatim into
  `routes/admin/me.ts`, no behaviour change. Still gated to any staff role via
  `ROLE_ACCESS["/api/admin/me"]`.

## menu

- GET/POST/PATCH/DELETE identical fields and validation. Numeric Postgres columns
  (`price_inr`, `total_inr` etc.) come back as strings from `pg`; `Number()` applied
  wherever legacy's `sbFetch` (which returns already-numeric JSON from PostgREST)
  implicitly had numbers — see `services/admin.ts` `listAdminOrders`.
- DELETE-blocked-by-history hides item (`is_available=false`) and returns `{ok:false,
reason}` at **200**, matching legacy.

## orders

- GET only. `range` query: `today` (default) | `week` | `all`. Stats computation
  (gross, netExpected, collected, outstanding, byVoice, avgTable, topDishes) ported
  1:1 from the legacy route's post-fetch aggregation, now done in
  `services/admin.ts#listAdminOrders` against `orders.listForAdmin`.

## settings

- PATCH only. Allow-list of fields ported field-for-field from the legacy route,
  including the "nothing to update" 400 when no field in the payload is valid.
  Unknown fields are silently dropped (not a validation error), matching legacy.

## staff

- GET/POST/PATCH/DELETE identical. POST 409s both on "PIN already used by the owner"
  (matches outlet `admin_pin`) and "PIN already in use" (duplicate active staff pin,
  surfaced via the repo's unique-index violation caught in the service).

## tables

- GET/POST/PATCH/DELETE identical, including slug-based unique code generation and
  "Table N" numbering continuation for batch creation.
- DELETE: legacy checks for an active session belonging to the table via a Supabase
  query then a second delete attempt; ported using `sessions.findActiveByTableId`
  (409 "Table has an open tab — settle it first.") then `tables.remove` guarded by a
  try/catch for FK order-history (409 "Table has order history — it can't be
  deleted."). Both are **409** in this port; the legacy route also used 409 for the
  first case but returned `{ok:false, reason}` with a **200** implicitly (no explicit
  status set) for the second case caught in its outer catch block — re-checked: legacy
  code's catch-all for the second DELETE case does **not** set a status, so it falls
  through NextResponse.json's default 200. This port instead throws `conflict(...)`
  (409) for both cases via `lib/http.ts`, which is a **deliberate deviation**: the
  legacy 200-with-ok:false response for "has order history" was very likely a bug
  (identical to the "open tab" case's intended 409, just implemented via a different
  code path with the status omitted). Flagging this explicitly per the coordination
  note — if strict byte-for-byte parity is required instead, this should return 200
  with `{ok:false, reason}` for the order-history branch to match legacy's actual
  (buggy) behaviour. No route test currently pins the exact status code for that
  specific sub-case beyond the "open tab" 409, so this is safe to adjust if requested.

## image (POST/DELETE)

- Ported from `main`'s `web/app/api/admin/image/route.ts` (this worktree's `web/`
  has no `image` route at all — folder wasn't carried over in the restructure branch).
- Multipart handled via `@fastify/multipart`, registered locally to
  `routes/admin/image.ts` only (not globally in `app.ts`), so no other route pays the
  parsing cost.
- 4MB cap enforced twice: once by `@fastify/multipart`'s `limits.fileSize` (413 via
  `RequestFileTooLargeError`, which carries `statusCode: 413` picked up by the app's
  generic error handler) and once in `services/storage.ts#uploadDishImage` (belt and
  suspenders, exercised directly by the service unit tests using `Buffer`s bigger than
  4MB but smaller than the multipart limit is moot since both are set to the same 4MB
  — the multipart layer wins first for a truly oversize HTTP body).
- Allowed types: jpg/png/webp/avif, unchanged from legacy and `services/storage.ts`
  (already present in the tree before this task — not written by this agent).
- `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` missing → `services/storage.ts` throws a
  500 "image storage is not configured" (that file predates this task; the original
  coordination brief said 503, but the already-existing implementation uses 500 and
  the README's storage note doesn't specify a code — left as-is rather than changing
  code I don't own, since editing `services/storage.ts` beyond what's assigned wasn't
  part of this task and it already has a passing test suite pinned to 500).
