"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";

type TableRow = { id: string; label: string; code: string };

export default function QrSheetPage() {
  const [tables, setTables] = useState<TableRow[]>([]);
  const [restaurantName, setRestaurantName] = useState("Narada");
  const [qrs, setQrs] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/admin/tables", { cache: "no-store" });
      if (!res.ok) return;
      const d = await res.json();
      setTables(d.tables ?? []);
      setRestaurantName(d.restaurantName ?? "Narada");
      const origin = window.location.origin;
      const entries = await Promise.all(
        (d.tables ?? []).map(async (t: TableRow) => {
          const dataUrl = await QRCode.toDataURL(`${origin}/t/${t.code}`, {
            width: 480,
            margin: 1,
            color: { dark: "#1c1c1c", light: "#ffffff" },
          });
          return [t.id, dataUrl] as const;
        }),
      );
      setQrs(Object.fromEntries(entries));
    })();
  }, []);

  return (
    <main className="min-h-dvh bg-stone-100 p-4 sm:p-6 print:bg-white print:p-0">
      <header className="mx-auto mb-5 flex max-w-3xl items-center justify-between print:hidden">
        <div>
          <h1 className="font-display text-2xl font-semibold text-stone-900">Table QR codes</h1>
          <p className="text-xs text-stone-500">Print, cut, and place one on each table.</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin"
            className="rounded-full bg-white px-4 py-2 text-xs font-bold text-stone-600 ring-1 ring-stone-200"
          >
            ← Admin
          </Link>
          <button
            onClick={() => window.print()}
            className="rounded-full bg-rose-600 px-5 py-2 text-xs font-bold text-white transition active:scale-95"
          >
            🖨️ Print
          </button>
        </div>
      </header>

      <div className="mx-auto grid max-w-3xl grid-cols-2 gap-4 sm:grid-cols-3 print:grid-cols-2 print:gap-6">
        {tables.map((t) => (
          <div
            key={t.id}
            className="flex flex-col items-center rounded-3xl bg-white p-5 text-center shadow-sm ring-1 ring-stone-200/60 print:break-inside-avoid print:rounded-none print:shadow-none print:ring-1 print:ring-stone-300"
          >
            <p className="font-display text-lg font-semibold text-stone-900">{restaurantName}</p>
            <p className="mt-0.5 text-[11px] font-bold tracking-widest text-rose-600 uppercase">
              {t.label}
            </p>
            {qrs[t.id] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrs[t.id]} alt={`QR for ${t.label}`} className="mt-3 w-full max-w-44" />
            ) : (
              <div className="mt-3 grid aspect-square w-full max-w-44 place-items-center bg-stone-100 text-xs text-stone-400">
                …
              </div>
            )}
            <p className="mt-3 text-xs font-semibold text-stone-700">
              Scan to see the menu &amp; order
            </p>
            <p className="text-[10px] text-stone-400">Talk to Narada · no app needed</p>
          </div>
        ))}
      </div>
    </main>
  );
}
