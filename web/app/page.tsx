import Link from "next/link";
import { RESTAURANT } from "@/lib/menu-data";

const DEMO_TABLES = [
  { code: "t1-demo", label: "Table 1", variant: "Classic" },
  { code: "t2-demo", label: "Table 2", variant: "Classic" },
  { code: "t3-demo", label: "Table 3", variant: "✨ Stories" },
  { code: "t4-demo", label: "Table 4", variant: "Classic" },
];

const STAFF_SCREENS = [
  { href: "/kitchen", label: "Kitchen", emoji: "👨‍🍳", hint: "live order tickets" },
  { href: "/waiter", label: "Waiter", emoji: "🔔", hint: "calls, tabs & payments" },
  { href: "/admin", label: "Admin", emoji: "⚙️", hint: "menu, staff, settings" },
  { href: "/admin/qr", label: "QR codes", emoji: "🖨️", hint: "printable table cards" },
];

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-14">
      <div className="text-center">
        <p className="text-5xl">🪈</p>
        <h1 className="font-display mt-3 text-4xl font-semibold tracking-tight">
          Narada
        </h1>
        <p className="mt-2 max-w-xs text-sm text-stone-500">
          Scan the QR at your table, browse the menu, and tell Narada what
          you&apos;d like. No app. No waiting.
        </p>
      </div>

      <div className="w-full max-w-xs rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-medium tracking-widest text-stone-400 uppercase">
          Customer — {RESTAURANT.name}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {DEMO_TABLES.map((t) => (
            <Link
              key={t.code}
              href={`/t/${t.code}`}
              className="rounded-2xl bg-rose-600 px-3 py-3 text-center text-white shadow-sm transition active:scale-95"
            >
              <span className="block text-sm font-semibold">{t.label}</span>
              <span className="block text-[10px] font-medium text-rose-100">
                {t.variant}
              </span>
            </Link>
          ))}
        </div>
        <p className="mt-3 text-center text-[11px] text-stone-400">
          In a restaurant, each table&apos;s QR opens its own link.
        </p>
      </div>

      <div className="w-full max-w-xs rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-medium tracking-widest text-stone-400 uppercase">
          Staff — PIN 1234
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {STAFF_SCREENS.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="rounded-2xl bg-stone-900 px-3 py-3 text-center text-white shadow-sm transition active:scale-95"
            >
              <span className="block text-lg leading-none">{s.emoji}</span>
              <span className="mt-1 block text-sm font-semibold">{s.label}</span>
              <span className="block text-[10px] font-medium text-stone-400">
                {s.hint}
              </span>
            </Link>
          ))}
        </div>
        <p className="mt-3 text-center text-[11px] text-stone-400">
          Each staff member can get their own PIN in Admin → Staff.
        </p>
      </div>
    </main>
  );
}
