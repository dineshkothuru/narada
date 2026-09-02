import Link from "next/link";
import { RESTAURANT } from "@/lib/menu-data";

const DEMO_TABLES = [
  { code: "t1-demo", label: "Table 1" },
  { code: "t2-demo", label: "Table 2" },
  { code: "t3-demo", label: "Table 3" },
  { code: "t4-demo", label: "Table 4" },
];

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-16">
      <div className="text-center">
        <p className="text-5xl">🪈</p>
        <h1 className="font-display mt-3 text-4xl font-semibold tracking-tight">
          Narada
        </h1>
        <p className="mt-2 max-w-xs text-sm text-stone-500">
          Scan the QR at your table, browse the menu, and tell Anna what
          you&apos;d like. No app. No waiting.
        </p>
      </div>

      <div className="w-full max-w-xs rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-medium tracking-widest text-stone-400 uppercase">
          Demo — {RESTAURANT.name}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {DEMO_TABLES.map((t) => (
            <Link
              key={t.code}
              href={`/t/${t.code}`}
              className="rounded-2xl bg-orange-600 px-4 py-3 text-center text-sm font-semibold text-white shadow-sm transition active:scale-95"
            >
              {t.label}
            </Link>
          ))}
        </div>
        <p className="mt-3 text-center text-[11px] text-stone-400">
          In a restaurant, each table&apos;s QR opens its own link.
        </p>
      </div>
    </main>
  );
}
