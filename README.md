# Narada — QR dine-in ordering with a voice waiter

**Narada** is both the product and the voice waiter customers talk to.

Scan a QR code at the table → menu opens in the browser → talk to a voice agent
(Sarvam AI for speech, Gemini for reasoning) that answers menu questions and takes
the order → cart → UPI payment.

No app install: the QR encodes a URL like `https://<domain>/t/<table-id>`, and the
whole experience is a mobile web app (PWA).

This is a **dine-in** flow — the customer at the table orders directly instead of
waiting for a waiter. That shapes a few decisions:

- **Table session, not one-shot order.** Scanning opens a session tied to the table.
  The customer can order in rounds (starters now, dessert later) on one running tab.
- **Pay-per-order or pay-at-end** — configurable per outlet. Indian dine-in
  usually settles at the end, so the default is: orders fire to the kitchen
  immediately, UPI payment happens once when the customer asks for the bill.
- **Waiter is still one tap away.** A "call waiter" button (and the agent understanding
  "bhaiya ko bulao" / "call the waiter") is essential — the system augments staff,
  it doesn't trap customers in a bot.
- **Kitchen gets a KOT** (kitchen order ticket) per round, tagged with the table number,
  exactly like a waiter would punch in.

## Run it yourself (5 minutes)

Prereqs: Node 20+, a free [Supabase](https://supabase.com) project, a
[Gemini API key](https://aistudio.google.com) and a [Sarvam AI key](https://dashboard.sarvam.ai).

```bash
git clone https://github.com/<owner>/narada
cd narada
npm install
```

1. **Configure env** — create `web/.env.local`:
   ```env
   SUPABASE_URL=https://<your-project>.supabase.co
   SUPABASE_ANON_KEY=<publishable/anon key>
   SUPABASE_SERVICE_ROLE_KEY=<secret/service_role key>
   SESSION_SECRET=<long random string, e.g. `openssl rand -hex 32` — signs staff login cookies>
   GEMINI_API_KEY=<optional — can be set later in /admin>
   SARVAM_API_KEY=<optional — can be set later in /admin>
   ```
2. **Create the database** — in the Supabase SQL editor run, in order:
   [`docs/schema.sql`](docs/schema.sql), [`docs/seed.sql`](docs/seed.sql),
   [`docs/migrate-i18n-columns.sql`](docs/migrate-i18n-columns.sql). On a DB created
   before 2026-09-03, also run
   [`docs/migrate-outlet-rename.sql`](docs/migrate-outlet-rename.sql) (fresh installs
   don't need it — the files above already produce the renamed schema).
3. **Run** — `npm run dev`, then open http://localhost:3000 and pick a table.

Where to click:

- `/t/t1-demo` — the customer experience (each table's QR points at its own code).
  Tap the 🎙️ button and _talk_ to Narada — Telugu, Hindi, or English.
- `/kitchen` — live kitchen dashboard (orders arrive here). Needs the staff PIN.
- `/admin` — menu availability, prices, payment timing, UPI ID, staff PIN, and
  the Gemini/Sarvam API keys. Same PIN.

Feedback welcome — open a GitHub issue with screenshots.

## End-to-end flow

```
Customer scans QR (table 12)
        │
        ▼
Menu web app opens (PWA) ──────────── browse menu manually (always available)
        │
        ▼  taps mic
Voice agent session (WebSocket)
        │
        ├─ Sarvam STT (Saarika)  : customer speech → text  (Hindi/Telugu/Tamil/English…)
        ├─ Gemini (function calls): understands question, answers from menu,
        │                           calls add_to_cart / remove_from_cart / confirm_order
        └─ Sarvam TTS (Bulbul)   : reply text → natural speech back to customer
        │
        ▼  "yes, that's my order"
Cart review screen (customer can still edit by hand)
        │
        ▼
UPI payment (Razorpay/Cashfree checkout, or raw upi:// deep link)
        │
        ▼  payment webhook confirms
Order fired to kitchen dashboard / printer
```

## Components

| #   | Component      | Tech                                                 | Notes                                                                                                                              |
| --- | -------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Customer PWA   | Next.js + Tailwind                                   | Menu, cart, mic button, payment screen. Mobile-first.                                                                              |
| 2   | Backend API    | Node.js (Fastify/Express)                            | Menu CRUD, orders, sessions, payment webhooks.                                                                                     |
| 3   | Voice pipeline | WebSocket server                                     | Streams mic audio → Sarvam STT → Gemini → Sarvam TTS → audio back.                                                                 |
| 4   | Agent brain    | Gemini (function calling)                            | System prompt = full menu JSON + rules. Tools: `answer from menu`, `add_to_cart`, `remove_from_cart`, `get_cart`, `confirm_order`. |
| 5   | Speech         | Sarvam AI                                            | Saarika (STT, streaming) + Bulbul (TTS). Built for Indic languages — the reason to pick it over Google/OpenAI speech.              |
| 6   | Payments       | Razorpay or Cashfree (recommended) or raw UPI intent | See payment options below.                                                                                                         |
| 7   | Kitchen view   | Simple web dashboard                                 | Live orders per table; mark preparing/served.                                                                                      |
| 8   | Admin          | Web dashboard                                        | Menu editor, table/QR generator, order history.                                                                                    |
| 9   | Database       | Postgres (Supabase is a fast start)                  | menus, items, tables, orders, payments.                                                                                            |

## Who talks to whom (your Sarvam→Gemini question)

Sarvam and Gemini don't talk to each other directly — **your backend orchestrates both**:

1. Browser streams mic audio over WebSocket to your backend.
2. Backend sends audio to **Sarvam STT** → gets text.
3. Backend sends text + menu context + cart state to **Gemini** → gets a reply
   and/or a tool call (e.g. `add_to_cart("Paneer Tikka", qty=2)`).
4. Backend executes the tool (updates cart in DB, pushes cart update to the UI),
   sends Gemini's reply text to **Sarvam TTS** → gets audio.
5. Audio streams back to the browser and plays.

This keeps you free to swap either vendor later (e.g. Sarvam-M instead of Gemini,
or Gemini Live API for speech-to-speech).

## Payment (UPI deep link — decided)

Plain `upi://pay?pa=<vpa>&pn=<name>&am=<amount>&tn=<order-id>` deep link opens
GPay/PhonePe/any UPI app directly. Zero fees, zero gateway onboarding. Trade-off:
no server-side payment confirmation, so staff verify payment on their own UPI app
(normal practice in Indian restaurants). No Razorpay/gateway integration.

**Payment timing is an admin setting** per outlet (`outlets.payment_timing`):

- `post` (default): order fires to the kitchen first, customer pays at the end —
  leaves the waiting window free for engagement (see below).
- `pre`: customer pays to place the order.

## Engagement (implemented)

- **Before ordering — Spin the Wheel 🎡**: one spin per table session, discount
  slices only (5/10/15% or try-again; hidden weights control generosity). Won
  discount auto-applies to the UPI amount.
- **While waiting — Memory Match 🃏**: 3 escalating levels (~5–8 min, matches the
  kitchen wait). Beating all levels wins a complimentary item (free dessert) —
  comps cost the outlet less than discounts.

## Identity & order updates

No login, no location, no phone number to start ordering — scanning the table's QR
_is_ the identity (table session). Order status updates:

- **In-app (live)**: Supabase Realtime on `orders` — status changes (preparing →
  served) push to the customer's open page and the kitchen dashboard.
- **WhatsApp (roadmap)**: optional phone number at checkout (admin setting), via
  WhatsApp Business Cloud API, for updates after the customer closes the page.

## Languages

UI ships in **English, Hindi, Telugu** (header toggle, persisted per session).
Narada replies in the customer's language — the app language by default, switching
automatically to whatever language the customer actually types/speaks. For voice,
Sarvam STT auto-detects the spoken language; the detected code drives both
Gemini's reply and Sarvam TTS so Narada speaks back in the same language.

## What you need before building

- **Sarvam AI API key** — dashboard.sarvam.ai (STT + TTS; check streaming quota).
- **Gemini API key** — aistudio.google.com (Flash tier is fast/cheap enough for this).
- **Domain + hosting** — Vercel (PWA) + any Node host (Railway/Render/Fly) for the
  WebSocket server; Supabase for Postgres. All have free tiers for the prototype.
- **Payment**: for the prototype nothing (option B); for production a Razorpay/Cashfree
  merchant account (outlet owner's KYC: PAN, bank account, GST if applicable).
- **Menu data** for one pilot outlet (names, descriptions, prices, veg/non-veg,
  spice level, allergens — the richer the data, the better the agent's answers).

## Build phases

1. **Phase 1 — Menu PWA + cart + QR** (no voice, no payment). Scan QR → browse →
   add to cart → "order" hits the kitchen dashboard. Proves the core loop.
2. **Phase 2 — Text agent.** Chat box wired to Gemini with menu context + cart tools.
   Gets the whole agent logic right before audio enters the picture.
3. **Phase 3 — Voice.** Add Sarvam STT/TTS streaming around the same agent.
4. **Phase 4 — Payments.** UPI deep link first, then gateway + webhook → auto-confirm.
5. **Phase 5 — Admin + polish.** Menu editor, QR generator per table, multi-language
   TTS voice choice, analytics.

## Repo layout (planned)

```
apps/
  web/        # customer PWA (Next.js)
  kitchen/    # kitchen + admin dashboard
  server/     # API + WebSocket voice pipeline
packages/
  agent/      # Gemini prompts, tool definitions, menu-grounding logic
  shared/     # types shared across apps (MenuItem, Cart, Order)
docs/
  ARCHITECTURE.md
```
