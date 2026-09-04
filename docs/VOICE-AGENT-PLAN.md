# Narada agents — commerce-agent pattern, no framework

Last updated: 2026-09-04. Companion to `MIGRATION-PLAN.md`; same layer rules, same tooling gates.

## Decision

Apply the [commerce-agents](https://github.com/anthropics/commerce-agents) pattern inside
`apps/api` with plain TypeScript. No LiveKit, Pipecat, Micdrop, no Python pod, no DI
container. Sarvam for STT/TTS. LLM = `google/gemini-3.1-flash-lite` via OpenRouter through
the Vercel AI SDK (`ai` v6 + `@openrouter/ai-sdk-provider`, pinned; decided 2026-09-04 over
the raw `openai` SDK for native zod tools, built-in multi-step loop, and `ai/test` mocks).

**Reference implementation**: `~/code/juice-bot` (same author, same stack: TS, Kysely, zod 4,
`openai` SDK, Sarvam) already runs Sarvam realtime STT + OpenRouter near-realtime in
production on Render. These are ported, not redesigned: `src/voice/realtime.ts`,
`src/voice/sarvam.ts`, `src/routes/live-voice.ts`, `src/agent/invariants.ts`,
`client/src/voice/*`, webhook-events pattern in `controllers/webhooks.ts`. (Its
`providers.ts` and scripted OpenAI client are superseded by the AI SDK.) Copy files; never share a package across
repos.

**Hosting**: Vercel stays for now (decided 2026-09-04). Every phase except live voice is
request-scoped (one turn per HTTP request, webhooks for WhatsApp) and runs there unchanged.
Live voice (Phase 5) needs a long-lived process and is deferred until hosting moves.
A `Dockerfile` and `railway.toml` already exist in the worktree (MIGRATION-PLAN Phase 5,
pending commit), so Railway is the natural target when that happens. Supabase
unchanged either way.

What changes: the model calls typed tools instead of emitting JSON-in-text; cart and
guardrails move server-side; order confirmation is a staged write; prompt is layered for
caching; voice stays turn-based on Vercel (live WebSocket with streaming transcripts is
Phase 5, gated on the hosting move); one runtime serves
three personas (customer, waiter, owner) and two channels (web, WhatsApp).

Diagrams: `.tmp/archify/voice-before.html` (current) and `voice-after.html` (target;
predates the hosting move and live socket — regenerate after Phase 5).

## Fixed constraints

- **STT/TTS**: Sarvam realtime STT (`wss://api.sarvam.ai/speech-to-text-realtime/ws`,
  `saaras:v3-realtime`, `language_code=auto`, server-side silence detection) for live voice;
  REST `speech-to-text` for WhatsApp voice notes; REST `text-to-speech` (`bulbul:v3`,
  validated speaker list). Sarvam uses the server-side `SARVAM_API_KEY`.
- **LLM**: `createOpenRouter({ apiKey })("google/gemini-3.1-flash-lite", { usage: { include: true },
provider: { allow_fallbacks: false } })` with `generateText` (`streamText` in Phase 5).
- **Keys**: OpenRouter and Sarvam use server environment keys (`OPENROUTER_API_KEY` and
  `SARVAM_API_KEY`) for now. Owner-supplied per-outlet keys are deferred until their
  security and administration model is defined.
- **Caching**: OpenRouter passes Gemini implicit caching through. Prompt static-first,
  volatile-last; verify with `usage.inputTokenDetails.cacheReadTokens`.
- **Layers**: controllers → one service → repositories. Zod schemas in `packages/shared`.
  Repos are the only Kysely users. Migrations as `docs/migrate-*.sql` + `docs/schema.sql`.
- **Tools call services only** — never repos, never HTTP loopback. A tool = zod-parse args →
  gate → exactly one service call → shape result. Same three steps as a controller.
- **Gates in code, not prompt**: item-ID provenance, sold-out refusal, per-line and line-count
  caps, serialized cart writes per session, staged confirm with server-issued id.
- **Prices come only from tools** (decided 2026-09-04): the system prompt's menu block carries
  ids, names (en/hi/te), veg flag, spice, tags, allergens — no `price_inr`. `search_menu`,
  `get_item`, `get_cart` return preformatted `price_display` / `total_display` strings the
  model copies verbatim. The server never composes customer prose.
- **Reply invariant** (from juice-bot): every ₹ figure and item id in a reply must appear in a
  tool result of the same turn; violation → one retry naming it, then a fixed neutral line.
- **Route contracts**: `/api/voice` keeps its path for text and voice turns (`/api/anna` was
  removed in the pending legacy-cleanup work; WhatsApp gets its own webhook).
  Live voice is a new WebSocket `/api/voice/live?token=…` (juice-bot protocol: `ready`,
  `transcript`, `turn`, `audio`, `error`). Web today sends text via `/api/voice {text}`, not
  `/api/anna`.

## Personas

One runtime, `runAgentTurn(deps, persona, principal, input)`. Persona = `{ name, prompt(ctx),
skillsDir, tools: string[], approval }`. The executor refuses any tool outside
`persona.tools`; the route picks the persona from the auth plugin, never from input.

|          | Customer                      | Waiter                            | Owner                                    |
| -------- | ----------------------------- | --------------------------------- | ---------------------------------------- |
| Identity | table session                 | staff JWT, role `waiter`          | admin JWT                                |
| Prompt   | menu-grounded waiter          | terse floor assistant, no upsell  | back-office analyst                      |
| Skills   | pairing, allergens, billing   | none                              | performance, catalog, inventory, pricing |
| Approval | customer taps confirm         | waiter taps confirm               | owner approves staged change in portal   |
| Channels | web live voice/text, WhatsApp | web live voice on phone, WhatsApp | portal chat, WhatsApp                    |

## Tool surface

Customer (Phases 1–7):

| Tool                                   | Kind         | Backs onto                | Gate                                                        |
| -------------------------------------- | ------------ | ------------------------- | ----------------------------------------------------------- |
| `search_menu(query?, category?, veg?)` | read         | `services/menu.ts`        | records returned ids in provenance                          |
| `get_item(itemId)`                     | read         | `services/menu.ts`        | records id                                                  |
| `get_cart()`                           | read         | `services/agentCart.ts`   | —                                                           |
| `add_to_cart(itemId, qty, notes?)`     | write        | `services/agentCart.ts`   | provenance, available, qty ≤ 10, lines ≤ 20, serialized     |
| `update_cart_item(itemId, qty)`        | write        | `services/agentCart.ts`   | same                                                        |
| `remove_from_cart(itemId)`             | write        | `services/agentCart.ts`   | provenance or already in cart                               |
| `confirm_order()`                      | staged write | `services/agentOrder.ts`  | returns `stagedOrderId`; UI confirms; server places only it |
| `call_waiter(reason?)`                 | write        | `services/waiterCall.ts`  | rate-limited (new capability — today only the button works) |
| `set_customer_name(name)`              | write        | session cart              | sanitized, ≤ 40 chars                                       |
| `set_language(en\|hi\|te)`             | ui           | —                         | drives TTS language + `uiLanguage`                          |
| `show_items(itemIds[])`                | ui           | —                         | provenance; max 3                                           |
| `quick_replies(options[])`             | ui           | —                         | max 3, each ≤ 24 chars, sanitized                           |
| `load_skill(name)`                     | read         | `apps/api/skills/*.md`    | allow-listed names                                          |
| `save_memory(key, value, category)`    | write        | `services/agentMemory.ts` | validator; signed-in customers only                         |
| `recall_memories(query?)`              | read         | `services/agentMemory.ts` | customer-scoped                                             |

Waiter and owner tools are listed in Phases 9 and 10. Schemas live once in
`packages/shared/src/schemas/agentTools.ts` (zod); `apps/api/src/services/agentTools.ts`
wraps each in `tool({ inputSchema, execute })` where `execute` = gate → one service.

## Phases and tasks

Order: A, 0, 1, 2, 3, 4, 6, 7, 8, 9, 10; Phase 5 (live voice) runs whenever hosting moves
off Vercel — nothing else depends on it. Each task: one subagent, one PR-sized commit, gates green
(`format:check`, `lint`, `typecheck`, `test`, `knip`). Model: Sonnet unless marked Opus.

**Estimation basis.** Wall-clock hours including Fable review, calibrated on this branch:
`6efe5aa` (3.9k lines, ~10 min to next commit), `67d3cf5` (4.6k lines, ~1 h), `e617338`
(2.4k lines, ~1 h). Ports with tight specs ≈ 2–4k lines/h; novel logic carries 2–3×. Phases
A2, A3, 5, 8 are ports from juice-bot and sit at the low end. Total ≈ 44–64 h; customer agent
usable after Phase 4 on Vercel (≈ 16–21 h); live voice adds 3–5 h once hosting moves. External waits and human device testing are listed per
phase and excluded. Fill **Actual** after each phase and rescale the rest.

| Phase | Estimate (h) | Actual (h) | Notes                        |
| ----- | ------------ | ---------- | ---------------------------- |
| A     | 3–5          | A1: 0.4    | A1 15 min agent + review     |
| 0     | 2            |            | needs keys + Hindi WAV       |
| 1     | 2            |            |                              |
| 2     | 3–5          |            |                              |
| 3     | 5–7          |            | Opus on T3.1                 |
| 4     | 1–2          |            | live-call verification       |
| 5     | 3–5          |            | deferred: needs hosting move |
| 6     | 3–4          |            |                              |
| 7     | 4–6          |            |                              |
| 8     | 4–6          |            | Meta verification external   |
| 9     | 3–5          |            |                              |
| 10    | 8–12         |            |                              |

### Phase A — composition root + test doubles (prerequisite, 3–5 h)

Decision: no DI container (awilix evaluated, rejected: name-based resolution and a runtime
without added testability at this size). Explicit dependency passing, one composition root,
in-process test doubles at the SDK boundary (juice-bot's proven approach; no MSW).

**A1 Composition root.** `src/deps.ts`: `type Deps = { env; repos: Repos; llm; sarvam;
storage; clock: () => Date }`, `makeDeps(db, overrides?: Partial<Deps>)`. `buildApp({ deps?:
Partial<Deps> })` replaces `buildApp({ repos })`; `app.decorate("deps")`, keep
`app.repos = deps.repos` so no route or test changes here. Services take `Pick<Deps, …>`.
_Acceptance_: existing tests pass with only the `buildApp` helper updated; `knip` clean.

**A2 Clients.** `src/clients/llm.ts`: `makeLlm(env)` → `LanguageModel` from
`createOpenRouter` (optionally `local` via `@ai-sdk/openai-compatible` for llama.cpp dev); `src/clients/sarvam.ts` ← juice-bot
`voice/sarvam.ts` (batch STT, TTS, translate, injectable `fetch`; the realtime session is
ported in T5.1, not here, so nothing unused lands); `src/clients/supabaseStorage.ts` from
`services/storage.ts`. Each a factory taking key/env, registered in `makeDeps`. Add deps `ai`,
`@openrouter/ai-sdk-provider` (pinned). `services/agent.ts`, `speech.ts`, `dictate.ts`, `storage.ts` receive clients
via `Pick<Deps, …>`. ESLint `no-restricted-globals: fetch` under `src/services/**`.
_Acceptance_: `grep 'fetch(' src/services` empty; typecheck green.

**A3 Test doubles.** `tests/helpers/scriptedLlm.ts`: thin wrapper over
`MockLanguageModelV4` from `ai/test` taking JSON steps `{text?, calls?}` (same fixture shape
as juice-bot's scripted client); `tests/helpers/fakeSarvam.ts` (in-memory
batch client surface; the fake `connect` for realtime comes with T5.1).
Update `tests/routes/voice.test.ts` to inject via `buildApp({ deps })`.
_Acceptance_: no `vi.stubGlobal("fetch")` / `vi.spyOn(globalThis, "fetch")` in api tests.

**A4 Convention docs.** `services/README.md` + `MIGRATION-PLAN.md`: services take
`Pick<Deps, …>`; external calls live in `src/clients/`; tests inject doubles via
`buildApp({ deps })`. _Acceptance_: docs updated.

### Phase 0 — baseline (2 h, needs keys)

**T0.1 Verify OpenRouter model + tool calling.** `.tmp/` script: `GET /api/v1/models`
confirms `google/gemini-3.1-flash-lite` with `tools` in `supported_parameters`; one
`generateText` with two tools and `toolChoice: "required"`; one `streamText` showing
tool-call parts precede text; confirm `usage.inputTokenDetails.cacheReadTokens` is populated
on a second call. Record here. Add
`OPENROUTER_API_KEY` and `SARVAM_API_KEY` to `env.ts` / `.env.example`; the model remains
the fixed `google/gemini-3.1-flash-lite`. Per-outlet key storage is deferred.
_Acceptance_: doc updated; key plumbing typechecks; existing route unchanged.

**T0.2 Latency baseline.** 3 s Hindi WAV ×10 against `POST /api/voice`: STT, LLM, TTS,
total p50/p90. Same clip through juice-bot's live path (final transcript → first audio) so
Phase 5's gain is measured. _Acceptance_: table below filled.

### Phase 1 — contracts (2 h)

**T1.1 Tool schemas.** `packages/shared/src/schemas/agentTools.ts`: zod input schema +
description per tool, `AGENT_TOOLS` registry, `AgentToolCall` union. Tests parse valid and
invalid args per tool. _Acceptance_: tests pass; `knip` clean.

**T1.2 Response contract.** `AnnaResponse`/`VoiceResponse` gain `cart: CartLine[]` (server
truth), `stagedOrderId?`; `actions` kept one release as `@deprecated`. _Acceptance_:
typecheck across web + api.

### Phase 2 — server-side cart and gates (3–5 h)

**T2.1 Migration.** `docs/migrate-agent-cart.sql` + `schema.sql`: `session_carts(session_id
pk, lines jsonb, provenance jsonb, customer_name text, updated_at)` and `staged_orders(id,
session_id, lines, created_at, placed_at)`. Repos `sessionCarts.ts`, `stagedOrders.ts`.
pglite repo tests. _Acceptance_: repo tests pass against `schema.sql`.

**T2.2 Cart service + gates.** `services/agentCart.ts` (`addLine`, `updateLine`,
`removeLine`, `recordProvenance`, `snapshot`); pure gates in
`packages/shared/src/agentGates.ts` with tests. Serialize writes per session with an
in-process keyed promise chain (`// ponytail: in-process lock; pg advisory lock if api runs

> 1 instance`). _Acceptance_: gate tests: unknown id, sold-out, qty cap, line cap, parallel
> adds cannot exceed cap.

**T2.3 Staged confirm.** `services/agentOrder.ts`: `stageOrder(session)` → id;
`placeStagedOrder(id, session)` calls `placeOrder` once, idempotent on `placed_at`. Route
`POST /api/order/confirm-staged {stagedOrderId}` under customer-session auth.
_Acceptance_: double confirm places once; other session's id → 404.

### Phase 3 — tool loop (5–7 h, Opus for T3.1)

**T3.0 Persona config.** `services/agentPersona.ts` (`Persona`, `Principal`), only
`customer` populated. `runAgentTurn(deps, persona, principal, input)`.

**T3.1 Tool loop.** `services/agent.ts`: replace `generateContent` + JSON-schema prompt with
`generateText({ model: deps.llm, system, messages, tools: personaTools(persona, ctx),
stopWhen: isStepCount(6), prepareStep })` where `prepareStep` returns `{ toolChoice:
"none" }` on the last step and restricts `activeTools` to `persona.tools`. Each tool's
`execute` = gate → one service; a gate refusal returns `{ blocked, reason }` as the tool
result, never throws. UI tools push payloads onto a per-turn collector. Provenance and
invariant inputs come from `result.steps`.
Keep `fallbackReply`. _Acceptance_: scripted-LLM test runs search → add → text, asserts
final cart + response.

**T3.2 Fencing + reply invariants.** `packages/shared/src/fence.ts` (strip control chars,
fence-marker mimicry, cap; wrap customer-authored text) and
`packages/shared/src/replyInvariants.ts` ← juice-bot `agent/invariants.ts` (₹ figures, qty
× item, ids must come from this turn's tool results; retry once, then neutral line).
Tests ported from commerce-agents `test_fencing.py` and juice-bot `invariants` tests.

**T3.3 Wire routes.** `/api/voice` calls `runAgentTurn`; voice adds batch
STT/TTS around it (this path stays for WhatsApp). Web drops client-side `actions`
application in `OrderExperience.tsx` for `cart` from the response. _Acceptance_: manual:
order two items by text; cart matches server; confirm flow places one KOT.

### Phase 4 — prompt layering and skills (1–2 h)

**T4.1 Prompt order.** Static (persona, rules, price-free menu JSON, tool guidance) first; dynamic
(cart, name, language, time, memory) last and fenced. Verify `cacheReadTokens > 0` from
turn 2 over 5 turns.

**T4.2 Skills.** `apps/api/skills/{billing,allergens,pairing}.md` via `load_skill`; system
prompt keeps only rules firing in ≥ ⅓ of turns. _Acceptance_: prompt tokens drop; skill
scenarios pass Phase 6 evals.

### Phase 5 — live voice (port from juice-bot, 3–5 h + device testing; DEFERRED until hosting moves)

Gated on leaving Vercel. Until then the batch path (`POST /api/voice`, browser VAD, WAV
upload) carries the full agent. Vercel's WebSocket beta (5-min cap) was considered and
rejected.

**T5.0 Hosting move.** Existing `Dockerfile` + `railway.toml` (pending commit) deployed to
Railway; health `/health`, env from `.env.example`. Vercel kept read-only until
DNS flips. _Acceptance_: one service serves web + API; `wss://` upgrade works via the
platform proxy.

**T5.1 Live socket.** `@fastify/websocket` at `/api/voice/live?token=…` ← juice-bot
`routes/live-voice.ts`: token = table/customer session token (Sarvam key stays server-side);
binary frames = 16 kHz PCM → `openLiveVoiceSession` (server-side Sarvam key); each `final` runs
`runAgentTurn` serialized per socket; emits `transcript` (partial/final), `turn` (reply, cart,
showItems, quickReplies, uiLanguage), `audio` (MP3 base64 per sentence). Phase 9 reuses it
with a staff token. _Acceptance_: fake-`connect` test replays two finals → two turns in
order, one cart.

**T5.2 Client.** `apps/web/src/voice/{useLiveVoice,liveProtocol,pcm-worklet}` ← juice-bot
`client/src/voice/*`; `VoiceMode.tsx` swaps MediaRecorder/VAD/base64 for the hook; audio
queued and played sequentially. Barge-in (new; juice-bot lacks it): a non-empty
`transcript.partial` while audio plays pauses playback and clears the queue. Delete
`lib/vad.ts`, `lib/audio.ts`, WAV path in `speech.ts` if unused after WhatsApp lands.
_Acceptance_: on a phone: partials visible while speaking; interrupt mid-sentence → next
turn within ~300 ms; Hinglish and Telugu land in the right `uiLanguage`.

### Phase 6 — evals and cleanup (3–4 h)

**T6.1 Snapshot evals.** `apps/api/tests/agent/*.test.ts`: constructed state + one message →
loop with scripted LLM fixtures → assert final cart, staged id, UI payloads. 20 cases: core
(add/remove/qty, veg filter, "that one"), safety (unknown id, sold-out, injection in notes,
invented price rejected), language (Hinglish, Telugu), confirm flow. _Acceptance_: green in CI.

**T6.2 Delete dead code.** JSON-action parsing, `actions` type, obsolete provider-specific
paths and key columns, unused web paths. `knip` clean. Update `MIGRATION-PLAN.md` status.

### Phase 7 — customer memory (4–6 h)

Identity: `customers` (optional phone/password accounts), `sessions.customer_id`. Memory keyed
by `customer_id`; guests persist nothing beyond the session cart. Per-outlet toggle
`outlets.memory_enabled`.

**T7.1 Store.** `docs/migrate-customer-memory.sql` + `schema.sql`: `customer_memories(id,
customer_id, outlet_id, key ≤64, value ≤200, category in ('preference','dietary','fact'),
source_digest, created_at, expires_at)`, unique `(customer_id, outlet_id, key)`; 180-day
expiry refreshed on write. Repo + pglite test.

**T7.2 Validator + writers.** `packages/shared/src/memoryFacts.ts` `validateFact` (length,
category, refuses identifier-shaped values: phone, email, card, UUID, address; refuses
health beyond dietary). Writers: `save_memory` tool and post-turn extraction in
`services/agentMemory.ts` (after reply is sent; reads last user + assistant text only, never
tool results; scripted-LLM JSON schema; skipped for guests). Tests incl. menu text in tool
output never becoming a fact.

**T7.3 Read layers.** Always-in-context: dietary + preference (≤ 10, fenced, after cart).
Lookup: `recall_memories`. Code gate: `show_items` and `add_to_cart` refuse items whose
allergens intersect a `dietary` fact.

**T7.4 Customer control.** `GET/DELETE /api/me/memories[/:id]` under account auth; "What
Narada remembers" list with per-row delete; purge wired into account deletion; in-flight
extraction discarded if customer vanished.

**T7.5 Evals.** Returning customer with `no peanuts` never sees a peanut item; "remember I
like it spicy" writes one fact; phone number refused.

### Phase 8 — WhatsApp channel (4–6 h; Meta verification 1–7 days external)

Webhook-based, fits the turn loop. Sender phone → `customers.phone`, so WhatsApp users get
Phase 7 memory. Table via QR deep link (`wa.me/<n>?text=T12`) or asked on first message.

**T8.1 Webhook (port).** `routes/whatsapp.ts` ← juice-bot `controllers/webhooks.ts`: `GET`
verify, `POST` receive, `X-Hub-Signature-256` verified, `whatsapp_inbox(message_id pk,
received_at)` write-first then 200 then work. Env `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`,
`WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`; `src/clients/whatsapp.ts` (send text, send
audio, get media). _Acceptance_: replayed fixture → one `runAgentTurn`, one outbound;
duplicate → none.

**T8.2 Voice notes.** Media → OGG/Opus → WAV (pick `@discordjs/opus` or static ffmpeg in
task) → batch STT → loop → TTS → audio message + text. _Acceptance_: Hindi note round-trips.

**T8.3 Session + confirm.** Conversation keyed by phone + outlet → table session when known,
else takeaway session. `confirm_order` staging identical; confirmation is a reply button
carrying the staged id, verified server-side. `show_items` → image messages (max 3);
`quick_replies` → reply buttons (max 3). _Acceptance_: WhatsApp order lands as one KOT.

### Phase 9 — waiter agent (3–5 h)

Persona `waiter`, staff JWT role `waiter`; text via `POST /api/waiter/agent`, voice via the
Phase 5 socket with a staff token. Replaces one-shot `/api/waiter/dictate`.

**T9.1 Tools.** `dictate_order(tableCode, text)` → resolves table in waiter's outlet, reuses
the cart tools with the table's session as scope; `table_status` → `floor.ts`;
`mark_served(tableCode, kotId)` → `waiter.ts`; `open_calls` / `resolve_call` →
`waiterCall.ts`; `note_to_kitchen`; `my_tips(range)` → `tips.ts`. Prompt: terse, no upsell,
read back before `confirm_order`. **T9.2 Web.** Waiter page gets the voice dock.
**T9.3 Evals.** 10 cases: table resolution, cross-outlet refused, read-back before confirm,
served transitions.

### Phase 10 — owner agent (8–12 h)

Persona `owner`, admin JWT; `POST /api/admin/agent`; portal chat + WhatsApp (staff phone).
Merchant half of commerce-agents: every write staged with guardrails and portal approval.

**T10.1 Read tools.** `business_snapshot(range)`, `query_metrics(metric, range, compare?)`
→ `admin/report.ts`; `search_listings` / `get_listing` → `adminMenu.ts`;
`inventory_alerts()`; `order_issues()` (stuck KOTs, open calls, unsettled bills).
**T10.2 Staged writes + guardrails.** `staged_changes(id, outlet_id, kind, payload,
created_by, created_at, approved_at, applied_at)`; tools `stage_availability`,
`stage_price_update`, `stage_listing_update`, `stage_staff_or_table_change`;
`packages/shared/src/changeGuardrails.ts` (items per change, price move ≤ 20 %, protected
fields); `apply_change(id)` only after portal approve route set `approved_at`; chat approval
sets nothing. Routes `GET /api/admin/changes`, `POST …/:id/approve`, `POST …/:id/discard`.
**T10.3 Portal UI.** Chat page + "Pending changes" drawer. **T10.4 Skills.**
`skills/owner/*.md` adapted from commerce-agents. **T10.5 Evals.** 15 cases incl. guardrail
refusals, apply-without-approval refused, cross-outlet id refused. **Later**: read-only SQL
analysis tool on a Supabase read-only role.

### Later, not in this plan

- Live phone calls (SIP) — the only channel that would justify a Pipecat/LiveKit worker.
- Kitchen/counter voice ("mark ready") — boards suffice.

## Baseline numbers (fill in T0.2 / T5.2)

| Stage                        | p50 ms | p90 ms | Notes |
| ---------------------------- | ------ | ------ | ----- |
| STT (batch)                  |        |        |       |
| LLM                          |        |        |       |
| TTS                          |        |        |       |
| Total (before)               |        |        |       |
| Final transcript → 1st audio |        |        | live  |

## Risks

- **Flash-Lite tool-calling on Hinglish/Telugu** — T0.1 spike + T6.1 cases; model changes
  require an explicit implementation decision.
- **OpenRouter hop** (~50–150 ms) — measured in T0.2; accepted for flexibility.
- **In-process cart lock** wrong under >1 API instance — documented ceiling; pg advisory lock.
- **Hosting move** — DNS/cert cutover and platform WebSocket proxy limits; verified in T5.0
  before the client swap.
- **Implicit cache hit rate** through OpenRouter — measure in T4.1; shrink menu JSON first.
- **Meta verification** for WhatsApp — start early; it gates Phase 8, nothing else.
