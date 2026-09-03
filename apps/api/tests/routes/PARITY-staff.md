# Parity notes — staff routes (kitchen, waiter, waiter/tips, floor, counter)

Ported 1:1 from:

- `web/app/api/kitchen/route.ts`
- `web/app/api/waiter/route.ts`
- `web/app/api/waiter/tips/route.ts`
- `web/app/api/floor/route.ts`
- `web/app/api/counter/route.ts` (main's version, already using `outlets`/`outlet_id` — no rename needed)

All five paths, methods, JSON shapes, and status codes are unchanged. Auth/role
gating for `/api/kitchen`, `/api/waiter`, `/api/floor`, `/api/counter` is
already enforced by `src/plugins/auth.ts`'s `ROLE_ACCESS` table — controllers
here do not re-check roles.

## Deliberate differences from the legacy handler

- **Errors are thrown, not returned.** Every `{error, status}` legacy return
  became an `HttpError` thrown from the service layer (`notFound`,
  `conflict`, `badRequest`), rendered by `app.ts`'s central error handler.
  Message strings are unchanged (`"unknown table"`, `"same session"`,
  `"unknown target"`, `"bill already raised"`, etc).
- **Body validation moved to zod.** The legacy routes hand-checked required
  fields per action with plain `if`s and a generic 400. The zod schemas
  (`packages/shared/src/schemas/{kitchen,waiter,floor,counter}.ts`) validate
  shape and enums; the controller still does the same "does this action have
  its required field" `if` chain the legacy handler had, so an
  action-without-its-field still 400s with the same message
  (`"invalid action"` / `"orderId and valid status required"` /
  `"invalid item status"`) rather than a zod-shaped error.
- **Numeric Postgres columns.** `Number()` applied wherever the legacy code
  did (`total_inr`, `amount_inr`, bill fields) — pg returns numeric columns as
  strings over the wire; the fake repos return JS numbers directly, so this
  only bites against the real Postgres-backed repos.
- **Kitchen PATCH `itemId`+`itemStatus` without a valid pair.** Legacy: any
  `itemId` present without matching `itemStatus` (or an invalid one) fell
  through to the whole-order 400 message
  (`"orderId and valid status required"`). Here: zod already rejects an
  invalid `itemStatus` enum value at the schema level (400, generic message),
  and `itemId` present without `itemStatus` (or vice versa) 400s with
  `"invalid item status"` — a single-field mismatch reads more clearly as an
  item-status problem than an order-status one. Functionally the same 400,
  different message for that one edge case; flagging it here as the one
  place the exact string diverges.
- **Waiter `record_payment` and counter `record_payment`/`generate_bill`**
  both call the _same_ `settle.ts` service functions the counter's Phase-1
  `/api/settle`-equivalent code already uses (`generateBill`,
  `recordPayment`) — not reimplemented per route, exactly like the legacy
  `web/lib/settle.ts` was one shared module imported by both
  `web/app/api/waiter/route.ts` and `web/app/api/counter/route.ts`.

## Repositories

No new repository functions were needed — `tables`, `sessions`, `orders`,
`orderItems`, `waiterCalls`, `payments`, `outlets` already exposed everything
these five routes needed (`listActiveForWaiter`/`listActiveForFloor`/
`listActiveForCounter`, `claimWaiter`, `clearCleaningIfNeeded`, etc), including
matching fakes in `tests/helpers/fakeRepos.ts`. `app.ts` route registration
was appended, not rewritten.

## Files

- Schemas: `packages/shared/src/schemas/{kitchen,waiter,floor,counter}.ts`
  (exported from `packages/shared/src/schemas/index.ts`, appended).
- Services: `apps/api/src/services/{kitchen,waiter,floor,counter}.ts`.
  `waiter.ts` and `counter.ts` reuse `services/settle.ts` and
  `services/billing.ts` rather than duplicating settlement math.
- Controllers: `apps/api/src/routes/{kitchen,waiter,waiterTips,floor,counter}.ts`,
  registered in `apps/api/src/app.ts` (appended).
- Tests: `apps/api/tests/services/{kitchen,waiter,floor,counter}.test.ts` (36
  tests, one per lifecycle branch and precondition failure) and
  `apps/api/tests/routes/{kitchen,waiter,waiterTips,floor,counter}.test.ts`
  (27 tests: happy path, one 4xx, one 403 per route). 63 tests total, all
  passing.
