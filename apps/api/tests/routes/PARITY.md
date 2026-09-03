# Parity notes: customer-facing routes

Legacy = `web/app/api/**/route.ts` on Supabase/PostgREST. New = Fastify routes
in `apps/api/src/routes/**` on Kysely/Postgres. Same paths, same JSON shapes
and status codes, with the deviations below called out explicitly.

## GET /api/session

| case                           | legacy                         | new  |
| ------------------------------ | ------------------------------ | ---- |
| missing `table`                | 400 `{error:"table required"}` | same |
| unknown table code             | 404 `{error:"unknown table"}`  | same |
| known table, no active session | 200 `{sessionId:null}`         | same |
| known table, active session    | 200 `{sessionId}`              | same |
| unexpected DB error            | 500 `{error:"failed"}`         | same |

## POST /api/order

| case                                                               | legacy                                                         | new  |
| ------------------------------------------------------------------ | -------------------------------------------------------------- | ---- |
| missing tableCode/empty cart                                       | 400 `{error:"tableCode and cart required"}`                    | same |
| no valid uuid item ids                                             | 400 `{error:"no valid items"}`                                 | same |
| cart sanitises to zero lines (unknown ids / qty out of 1-50 range) | 400 `{error:"no valid items"}`                                 | same |
| unknown table                                                      | 404 `{error:"unknown table"}`                                  | same |
| happy path                                                         | 200 `{orderId,orderNo,total,discountPct,sessionId,tableLabel}` | same |
| unexpected DB error                                                | 500 `{error:"could not place order"}`                          | same |
| rate limit (>15/min/ip)                                            | 429 `{error:"too many requests"}`                              | same |

## GET /api/order

| case                       | legacy                                                                                            | new                                                                                       |
| -------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| neither `id` nor `session` | 400 `{error:"id or session required"}`                                                            | same                                                                                      |
| `?session=` happy path     | 200 `{rounds,discountPct,sessionStatus}`, rounds pre-filtered `status=neq.cancelled` at the query | same — cancelled rounds filtered in the service instead of the query, same visible result |
| `?id=` unknown order       | 404 `{error:"not found"}`                                                                         | same                                                                                      |
| `?id=` happy path          | 200 `{status}`                                                                                    | same                                                                                      |
| unexpected DB error        | 500 `{error:"lookup failed"}`                                                                     | same                                                                                      |

## GET /api/bill

| case                | legacy                                                                           | new                                                                                                                                                                                                                                                 |
| ------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| missing `session`   | 400 `{error:"session required"}`                                                 | same                                                                                                                                                                                                                                                |
| unknown session     | `computeBill` throws a plain Error, caught by the route → 500 `{error:"failed"}` | **deviation**: `services/billing.ts` (ported by another agent, shared code path) throws `notFound("unknown session")` → 404 `{error:"unknown session"}`. Not introduced by this route port; the new status is more correct but differs from legacy. |
| happy path          | 200 `{...bill, rounds}`                                                          | same                                                                                                                                                                                                                                                |
| unexpected DB error | 500 `{error:"failed"}`                                                           | same                                                                                                                                                                                                                                                |

## PATCH /api/bill

| case                                                                           | legacy                                       | new  |
| ------------------------------------------------------------------------------ | -------------------------------------------- | ---- |
| missing `sessionId`                                                            | 400 `{error:"sessionId required"}`           | same |
| `tableCode` given, session doesn't belong to that table                        | 403 `{error:"not your table"}`               | same |
| nothing to update (`serviceWaived`/`tip` both absent or `tip` out of 0-100000) | 400 `{error:"nothing to update"}`            | same |
| happy path                                                                     | 200 `{...bill}` (via computeBill, no rounds) | same |
| unexpected DB error                                                            | 500 `{error:"failed"}`                       | same |
| rate limit (>20/min/ip)                                                        | 429 `{error:"too many requests"}`            | same |

## POST /api/reward

| case                                                                  | legacy                                      | new  |
| --------------------------------------------------------------------- | ------------------------------------------- | ---- |
| missing tableCode/type                                                | 400 `{error:"tableCode and type required"}` | same |
| unknown table                                                         | 404 `{error:"unknown table"}`               | same |
| `type:"spin"`, session already has a discount                         | 200 `{ok:false,discountPct,sliceIndex}`     | same |
| `type:"spin"`, fresh claim wins                                       | 200 `{ok:true,discountPct,sliceIndex}`      | same |
| `type:"spin"`, fresh claim loses the race                             | 200 `{ok:false,discountPct,sliceIndex}`     | same |
| `type:"comp"`, no orders yet                                          | 400 `{ok:false,reason:"no orders yet"}`     | same |
| `type:"comp"`, already awarded                                        | 200 `{ok:false,reason:"already awarded"}`   | same |
| `type:"comp"`, comp item missing from outlet config and fallback name | 500 `{error:"comp item missing"}`           | same |
| `type:"comp"`, happy path                                             | 200 `{ok:true,item}`                        | same |
| unexpected DB error                                                   | 500 `{error:"failed"}`                      | same |
| rate limit (>10/min/ip)                                               | 429 `{error:"too many requests"}`           | same |

## POST /api/waiter-call

| case                           | legacy                                 | new  |
| ------------------------------ | -------------------------------------- | ---- |
| missing tableCode              | 400 `{error:"tableCode required"}`     | same |
| unknown table                  | 404 `{error:"unknown table"}`          | same |
| happy path (first call)        | 200 `{ok:true}`, inserts one open call | same |
| happy path (call already open) | 200 `{ok:true}`, no second insert      | same |
| unexpected DB error            | 500 `{error:"failed"}`                 | same |
| rate limit (>6/min/ip)         | 429 `{error:"too many requests"}`      | same |

## POST /api/anna

| case                                                       | legacy                                                                                                            | new                                                                                                                                                                                                                                                                                             |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| missing/empty `messages`                                   | 400 `{error:"messages required"}`                                                                                 | same                                                                                                                                                                                                                                                                                            |
| Gemini call throws (no key, network, non-retryable status) | 502 `{error:"Anna is unavailable right now"}`                                                                     | same                                                                                                                                                                                                                                                                                            |
| happy path                                                 | 200 `AnnaResponse` JSON                                                                                           | same                                                                                                                                                                                                                                                                                            |
| unknown table code                                         | legacy `fetchMenu` always returns a menu (falls back to a bundled local fixture when Supabase/table lookup fails) | **deviation**: the API has no bundled fixture menu, so an unknown/blank table code yields an empty in-memory menu (`categories:[]`, `items:[]`) built inline in the route instead of a null. Anna still answers, just with nothing to recommend — flagged for the team, not a new failure mode. |
| rate limit (>30/min/ip)                                    | 429 `{error:"too many requests"}`                                                                                 | same                                                                                                                                                                                                                                                                                            |

## POST /api/voice

| case                                                  | legacy                                                                                                               | new                                                                                                                                                                                                                                                                            |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| no Sarvam key configured (outlet + env both empty)    | 500 `{error:"Sarvam API key not configured (admin settings or env)"}`                                                | same                                                                                                                                                                                                                                                                           |
| audio/text/greet all absent                           | 400 `{error:"audio, text or greet required"}`                                                                        | same (enforced by the zod schema's refine, before the service even runs)                                                                                                                                                                                                       |
| audio over 4MB base64                                 | 413 `{error:"audio too long"}`                                                                                       | same                                                                                                                                                                                                                                                                           |
| Sarvam STT non-2xx                                    | 502 `{error:"could not hear you"}`                                                                                   | same                                                                                                                                                                                                                                                                           |
| STT returns an empty transcript                       | 422 `{error:"empty transcript"}`                                                                                     | same                                                                                                                                                                                                                                                                           |
| Gemini/Anna throws mid-turn                           | falls back to a canned reply in the detected language, still 200                                                     | same                                                                                                                                                                                                                                                                           |
| unknown table code, so `fetchMenu` can't build a menu | legacy always has a menu (bundled fixture fallback)                                                                  | **deviation**: `services/speech.ts` throws `HttpError(500, "voice failed")` when the menu service returns null (no bundled fixture in the API) — same status code and message as the legacy generic catch-all, so the outward behaviour lines up even though the cause differs |
| happy path (greet)                                    | 200 `{transcript:"", detectedLanguage, uiLanguage, reply, actions, suggestCheckout, showItems, quickReplies, audio}` | same                                                                                                                                                                                                                                                                           |
| rate limit (>20/min/ip)                               | 429 `{error:"too many requests"}`                                                                                    | same                                                                                                                                                                                                                                                                           |

## General deviations across all seven routes

- **Zod validation error messages**: where the legacy route's manual checks
  and this port's zod schemas can both fail on the same missing/invalid
  field, the route surfaces the zod issue's `message`, which was set to match
  the legacy string exactly (e.g. `"tableCode and cart required"`). Custom
  multi-field checks (e.g. PATCH /api/bill's "nothing to update", which
  depends on the _parsed_ body, not just its shape) stay in the service/route
  layer rather than zod, since zod validates shape, not cross-field business
  rules.
