# Parity notes — admin routes

These notes compare the pre-restructure admin route contracts with the Fastify
routes. The image contract is from the main branch's legacy image handler.

Staff authentication has one outlet-scoped entry point. Deliberate contract
replacements and response differences are recorded below rather than treated as
unchanged parity.

## categories

- POST/DELETE identical. `POST` 400 on empty name, DELETE 400 without `id`.
- Delete-blocked-by-history path: legacy relies on a thrown Postgres FK error from
  `sbFetch`; the Kysely repo throws the same way on delete, caught identically, then
  `menu_items.hideByCategory` marks items unavailable and returns `{ok:false, reason}`
  with **200**, matching legacy (no status code change on that branch).

## login

- The entry point is `POST /api/outlet/:slug/login`, requiring
  `{username, password}`. The outlet is selected from the URL slug, and the
  username is trimmed and lowercased before matching an active account within
  that outlet.
- The server derives the role from the matched account. There is no
  client-supplied role or outlet selector; invalid outlet, username, and
  password combinations share the same generic failure.
- The POST route uses `rateLimited(10)` and the shared generic rate-limit
  message.
- Successful login sets the HTTP-only `narada_staff` cookie. Its signed v3 token
  contains `staffId`, `outletId`, stored role, and expiry; `secure` is enabled in
  production. `DELETE /api/auth/staff/logout` clears it and remains reachable
  without a valid session.

## me

- `GET /api/admin/me` remains available to every staff role, but its response now
  comes from the authenticated account. It returns role, full staff identity
  (`id`, `username`, first/last/display name), outlet identity, and flattened
  compatibility fields.
- Every protected request verifies the v3 signature and expiry, then reloads the
  active staff and outlet. The stored outlet and role must match the claims, so
  deactivation or a role/outlet mismatch invalidates an existing cookie.

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

- GET/POST/PATCH/DELETE retain the account-management paths and are scoped to the
  authenticated admin's outlet. POST requires a lowercase username, required
  first name, optional last name, stored role, and a 15–128-code-point password.
  Duplicate usernames return 409 only within the same outlet.
- PATCH can enroll an incomplete legacy row or update identity, role, active
  state, and optionally password. Self-deletion/deactivation and removal or
  demotion of the final active admin are rejected. Password hashes are never
  included in staff responses.

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

- Ported from the main branch's legacy image handler (the route was not present
  in the deleted legacy workspace on this branch).
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

## tenant scope

Protected admin reads and mutations derive the outlet from the authenticated staff
session. The body `outletId` in settings is accepted for old clients but ignored when
the session outlet is available; cross-outlet IDs behave as unknown and do not mutate
the other outlet. Menu, order, table, and image repository queries carry the session
outlet predicate.
