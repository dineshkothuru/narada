import { useEffect, useState } from "react";
import QRCode from "qrcode";
import AdminShell from "@/components/AdminShell";
import { tableQrUrl } from "@/lib/qr";
import { useAdminTables } from "@/api/hooks";

export default function AdminQrPage() {
  const { data } = useAdminTables();
  const tables = data?.tables ?? [];
  const outletName = data?.outletName ?? "Narada";
  const [qrs, setQrs] = useState<Record<string, string>>({});

  useEffect(() => {
    if (tables.length === 0) return;
    let cancelled = false;
    (async () => {
      const origin = window.location.origin;
      const entries = await Promise.all(
        tables.map(async (t) => {
          const dataUrl = await QRCode.toDataURL(tableQrUrl(origin, t.code), {
            width: 480,
            margin: 1,
            color: { dark: "#1c1c1c", light: "#ffffff" },
          });
          return [t.id, dataUrl] as const;
        }),
      );
      if (!cancelled) setQrs(Object.fromEntries(entries));
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables.map((t) => t.id).join(",")]);

  return (
    <AdminShell>
      <main className="min-h-dvh bg-[#eeebe8] p-4 sm:p-6 print:bg-white print:p-0">
        <header className="mx-auto mb-5 flex max-w-3xl items-center justify-between print:hidden">
          <div>
            <h1 className="font-display text-2xl font-semibold text-stone-900">Table QR codes</h1>
            <p className="text-xs text-stone-500">Print, cut, and place one on each table.</p>
          </div>
          <div className="flex gap-2">
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
              className="card-float flex flex-col items-center rounded-3xl bg-white p-5 text-center ring-1 ring-stone-200/80 print:break-inside-avoid print:rounded-none print:shadow-none print:ring-1 print:ring-stone-300"
            >
              <p className="font-display text-lg font-semibold text-stone-900">{outletName}</p>
              <p className="mt-0.5 text-[11px] font-bold tracking-widest text-rose-600 uppercase">
                {t.label}
              </p>
              {qrs[t.id] ? (
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
    </AdminShell>
  );
}
