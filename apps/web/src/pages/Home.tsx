import { Link } from "react-router";

// web/lib/menu-data.ts OUTLET.name — that module pulls in the full demo menu
// dataset (customer ordering flow, out of scope for this batch), so only the
// one field this page needs is copied here for now.
const OUTLET_NAME = "Spice Garden";
const OUTLET_SLUG = "demo-spice-garden";

const DEMO_TABLES = [
  { code: "t1-demo", label: "Table 1", variant: "Classic" },
  { code: "t2-demo", label: "Table 2", variant: "Classic" },
  { code: "t3-demo", label: "Table 3", variant: "✨ Stories" },
  { code: "t4-demo", label: "Table 4", variant: "Classic" },
];

const STAFF_SCREENS = [
  {
    href: `/outlet/${OUTLET_SLUG}/login`,
    label: "Staff login",
    emoji: "🔐",
    hint: "outlet-scoped access",
  },
];

export default function Home() {
  return (
    <main className="console flex flex-1 flex-col items-center justify-center gap-8 px-6 py-12 lg:py-16">
      <div className="max-w-xl text-center">
        <p className="text-5xl">🪈</p>
        <h1 className="font-display mt-3 text-4xl font-semibold tracking-tight">Narada</h1>
        <p className="mt-2 max-w-xs text-sm text-stone-500">
          Scan the QR at your table, browse the menu, and tell Narada what you&apos;d like. No app.
          No waiting.
        </p>
      </div>

      <div className="grid w-full max-w-4xl gap-4 md:grid-cols-2">
        <section className="panel panel-lift p-5">
          <p className="text-xs font-medium tracking-widest text-slate-400 uppercase">
            Customer — {OUTLET_NAME}
          </p>
          <Link
            to={`/outlet/${OUTLET_SLUG}`}
            className="mt-3 block rounded-2xl bg-rose-600 px-3 py-3 text-center text-white shadow-sm transition hover:bg-rose-700 active:scale-95"
          >
            <span className="block text-sm font-semibold">Takeaway</span>
            <span className="block text-[10px] font-medium text-rose-100">Order to go</span>
          </Link>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {DEMO_TABLES.map((t) => (
              <Link
                key={t.code}
                to={`/outlet/${OUTLET_SLUG}/table/${t.code}`}
                className="rounded-2xl bg-rose-600 px-3 py-3 text-center text-white shadow-sm transition hover:bg-rose-700 active:scale-95"
              >
                <span className="block text-sm font-semibold">{t.label}</span>
                <span className="block text-[10px] font-medium text-rose-100">{t.variant}</span>
              </Link>
            ))}
          </div>
          <p className="mt-3 text-center text-[11px] text-slate-400">
            In an outlet, each table&apos;s QR opens its own link.
          </p>
          <Link
            to="/login"
            className="mt-4 block text-center text-xs font-semibold text-rose-600 underline-offset-4 hover:underline"
          >
            Customer account · sign in
          </Link>
        </section>

        <section className="panel panel-lift p-5">
          <p className="text-xs font-medium tracking-widest text-slate-400 uppercase">
            Staff · password required
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {STAFF_SCREENS.map((s) => (
              <Link
                key={s.href}
                to={s.href}
                className="rounded-2xl bg-white px-3 py-3 text-center text-slate-700 ring-1 ring-slate-300 shadow-sm transition hover:bg-slate-50 active:scale-95"
              >
                <span className="block text-lg leading-none">{s.emoji}</span>
                <span className="mt-1 block text-sm font-semibold">{s.label}</span>
                <span className="block text-[10px] font-medium text-slate-400">{s.hint}</span>
              </Link>
            ))}
          </div>
          <p className="mt-3 text-center text-[11px] text-slate-400">
            Your account determines which staff screen opens.
          </p>
        </section>
      </div>
    </main>
  );
}
