# Narada — QR dine-in ordering with a voice waiter

**Narada** is both the product and the voice waiter guests talk to.

Scan the QR at your table → the menu opens in the browser → talk to Narada in
English, Hindi or Telugu → order → pay by UPI. No app install: the QR encodes
`https://<domain>/t/<table-code>` and the whole thing is a mobile web app.

Behind it is a full back office — floor, kitchen, waiter, counter and owner
screens, each gated to the person who does that job.

---

## What it does

**For the guest**

- Scan, browse, and order in rounds on one running tab — starters now, dessert
  later — the way dine-in actually works.
- Talk to Narada instead of hunting the menu. Sarvam hears the speech, Gemini
  answers from the menu, Sarvam speaks the reply back in the same language.
  Romanised Hinglish and Tenglish are understood and answered in kind.
- Remove something ordered by mistake, while the kitchen has not started it.
- Two table experiences, switchable per table: a classic list, or **Feast
  Stories** — full-screen swipeable dish stories that Narada can navigate by
  voice.
- Engagement while they wait: a spin wheel for a discount before ordering, and a
  memory game that wins a complimentary dish. Rewards are claimed server-side, so
  a forged discount is rejected.
- Ask for the bill, waive the service charge, add a tip, pay by UPI.

**For the restaurant**

| Screen | Who | What it is for |
|---|---|---|
| `/floor` | reception, waiter, counter, owner | The room: who is free, seated, dining, billed, being cleaned. Seat, merge, release. |
| `/waiter` | waiter, owner | Calls, tables waiting to order, running tabs, plated dishes to carry out. |
| `/waiter/table/[code]` | waiter, owner | One table: every round, every dish's progress, the bill — and a Menu tab to add another round. |
| `/kitchen` | kitchen, owner | Tickets across New / Preparing / Ready / Served, per dish or per round. Mark a dish sold out. Reprint a KOT. |
| `/counter` | cashier, owner | Raise bills, take payment by UPI, card or cash. |
| `/admin/report` | owner | Day close: takings, covers, GST collected, tips, and payments reconciled against bills. |
| `/admin/*` | owner | Menu, dish photos, tables and QR sheets, staff logins, settings. |

---

## How the pieces fit

```
Guest's phone                    Narada (Next.js app)               Services
─────────────                    ────────────────────               ────────
scan QR  ──────────────────────► /t/[code]  session opens
tap mic  ── audio ─────────────► /api/voice ──────────────────────► Sarvam STT
                                      │                             (saarika)
                                      ▼
                                 lib/anna   full menu + cart ──────► Gemini
                                      │                             (2.5 flash)
                                      ▼
  ◄───── reply audio ──────────  Sarvam TTS (bulbul) ◄──────────────┘
                                      │
  "yes, order that"  ────────────────►│
                                      ▼
                                 /api/order   round created
                                      │
                                      ├──────► /kitchen   ticket appears
                                      └──────► /waiter    tab updates
                                      ▼
                                 counter raises the bill
                                      ▼
                                 payment taken anywhere ──────────► UPI deep link
```

Sarvam and Gemini never talk to each other — the app orchestrates both, so
either can be swapped without touching the other.

**The stack is deliberately small.** One Next.js app, five runtime dependencies
(`next`, `react`, `react-dom`, `qrcode`, `server-only`), Tailwind for styling and
Postgres through Supabase's REST interface. There is no separate API server, no
Fastify or Express, and no WebSocket: every endpoint is a Next.js route handler,
and voice is request/response — the browser records a clip, posts it to
`/api/voice`, and gets audio back. Streaming would cut the pause between speaking
and hearing a reply, and is the obvious next step; it is not needed to make the
thing work.

---

## The rules the code enforces

These are the decisions worth knowing before reading the source. Each is
enforced server-side, not just hidden in the UI.

**A raised bill is frozen.** The counter raises it, which mints the invoice
number and fixes the totals. After that nothing can move them — a guest cannot
waive the service charge, and a tip is added by *paying more*, not by editing an
invoice.

**Raising the bill and taking the money are different jobs.** Only the counter
(or the owner) raises a bill. Anyone can record a payment against one, because
the guest pays wherever they are — UPI at the table, cash to a waiter, card at
the counter. Money is never taken against totals that can still move.

**Overpayment is the tip.** Nobody knows the tip when the bill is raised, so
bills are raised plain and whatever arrives above the total is credited as a tip
to whoever was attending that table. It is frozen with the amount, so
reassigning the table later cannot move money already handed over.

**A dish can be taken back until the kitchen starts it.** While it is `queued`
the guest can remove it themselves. After that it exists, and only staff can
void it — recorded against their name, never once it has been served.

**A visit ends everything attached to it.** Settling the bill, releasing a table
that never ordered, or handing a cleaned table back all close any waiter call
still open for that table, so a paid table cannot keep ringing.

**Payment does not free a table.** It moves to `cleaning` until a waiter hands it
back, because the party is still sitting there.

**PINs are never stored.** Staff sign in with a PIN; only a PBKDF2 hash with a
per-restaurant salt is kept. A PIN can be replaced, never read back.

**Colour means something.** On the staff console, rose is an alert, amber wants
attention, emerald is settled, and everything else is neutral. Buttons carry no
colour at all — the label says what they do.

---

## Run it

Node 20+, a [Supabase](https://supabase.com) project, a
[Gemini key](https://aistudio.google.com), a [Sarvam key](https://dashboard.sarvam.ai).

```bash
git clone https://github.com/dineshkothuru/narada
cd narada/web
npm install
```

**1. Environment** — `web/.env.local`:

```env
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service_role key>
GEMINI_API_KEY=<optional — the owner can set this in /admin instead>
SARVAM_API_KEY=<optional — same>
```

Keys set in `/admin` win over the environment; the env vars are the fallback for
local development. They are read server-side only and cached for a minute, so a
change takes up to that long to take effect.

**2. Database** — run in the Supabase SQL editor, in order:
[`docs/schema.sql`](docs/schema.sql) → [`docs/seed.sql`](docs/seed.sql) →
[`docs/migrate-i18n-columns.sql`](docs/migrate-i18n-columns.sql).

Dish photos need a public Storage bucket named `menu` — the command is at the
bottom of `docs/schema.sql`.

**3. Run** — `npm run dev`, then http://localhost:3000.

```bash
npm run dev      # development server
npm test         # 95 tests
npm run lint
npm run build
```

**Where to click first:** `/t/table-1` for the guest experience (tap the mic and
talk), then `/admin/login` with the owner PIN for everything else.

---

## Testing

95 tests over the logic that decides money and state — deliberately pure, with
no database behind them:

| File | Covers |
|---|---|
| `billing-math` | GST per item on the discounted value, CGST/SGST split, waivable service charge, untaxed tip, rupee rounding |
| `settle-math` | how a payment splits between the bill and a tip |
| `status` | the order and table state machines |
| `cancel` | who may take a dish back, and when |
| `tips` | per-waiter tallies, and the restaurant's day rather than UTC's |
| `admin-auth` | role gating, and staff tokens against tampering and expiry |

Two of these caught real bugs when first written: a tip tally that dragged the
server-only database client in behind it, and an empty ticket deriving as
`served` because `[].every()` is true.

---

## Layout

```
web/
  app/
    t/[code]            the guest's table
    floor waiter        staff screens
    kitchen counter
    admin/…             owner: menu, tables, users, orders, day close
    api/…               every route above, gated by middleware
  components/           OrderExperience, StoryViewer, OrderPad, TableSheet, …
  lib/
    anna.ts             Gemini prompt and conversation
    dictate.ts          a waiter speaking an order into lines
    billing-math.ts     the money rules, pure
    settle.ts           raising a bill and recording payment
    status.ts           order and table state machines
    admin-auth.ts       roles, tokens, path gating
    pin.ts audit.ts     hashed PINs, who did what
  tests/                the pure logic above
docs/schema.sql         the whole database
```

Roles are declared once in `lib/admin-auth.ts` and enforced by `middleware.ts`;
the sidebar reads the same table, so a screen a role cannot open is a screen it
never sees.

---

## Known limits

- **Single restaurant.** Queries take the first row of `restaurants`. The schema
  is multi-tenant; the queries are not yet.
- **UPI is a deep link.** Zero fees and no gateway onboarding, but no automatic
  confirmation — staff enter the UTR, which is normal practice here.
- **WhatsApp updates are not built.** Bills can be shared to WhatsApp by a link.
  Automated kitchen updates need a Meta WhatsApp Business account, a registered
  number and an approved template.
- **Idle tables never close by themselves.** A host releases them.

## Languages

English, Hindi and Telugu, toggled in the header and remembered per session.
Narada answers in whatever language the guest actually used — Sarvam detects
spoken language, and code-mixed romanised input is matched against Telugu and
Hindi markers rather than being treated as English.
