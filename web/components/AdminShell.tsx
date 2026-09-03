"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import CallTimer from "./CallTimer";
import CallAlertBar, { type OpenCall } from "./CallAlertBar";

const NAV = [
  { href: "/admin", label: "Menu & settings", emoji: "⚙️" },
  { href: "/admin/orders", label: "Orders", emoji: "🧾" },
  { href: "/floor", label: "Floor", emoji: "🪑" },
  { href: "/waiter", label: "Waiter", emoji: "🔔" },
  { href: "/kitchen", label: "Kitchen", emoji: "👨‍🍳" },
  { href: "/admin/qr", label: "QR codes", emoji: "🖨️" },
];

// Left sidebar for every staff screen, with a live call watchlist so an
// unattended table is visible from anywhere in the admin.
export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [calls, setCalls] = useState<OpenCall[]>([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/floor", { cache: "no-store" });
      if (!res.ok) return;
      const d = await res.json();
      setCalls(
        (d.tables ?? [])
          .filter((t: { calling: boolean }) => t.calling)
          .map(
            (t: {
              id: string;
              label: string;
              callSince: string;
              attendant: string | null;
            }) => ({
              id: t.id,
              label: t.label,
              since: t.callSince,
              attendant: t.attendant,
            }),
          ),
      );
    } catch {}
  }, []);

  useEffect(() => {
    const tick = () => {
      if (!document.hidden) load();
    };
    const t = setTimeout(tick, 0);
    const iv = setInterval(tick, 5000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearTimeout(t);
      clearInterval(iv);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [load]);

  const logout = async () => {
    await fetch("/api/admin/login", { method: "DELETE" });
    window.location.replace("/admin/login");
  };

  return (
    <div className="flex min-h-dvh bg-stone-100">
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-60 flex-col bg-stone-950 p-4 text-white transition-transform lg:static lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-5 flex items-center justify-between">
          <Link href="/admin" className="font-display text-xl font-semibold">
            🪈 Narada
          </Link>
          <button
            onClick={() => setOpen(false)}
            className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-sm lg:hidden"
          >
            ✕
          </button>
        </div>

        <nav className="flex flex-col gap-1">
          {NAV.map((n) => {
            const active = pathname === n.href;
            return (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                  active ? "bg-rose-600 text-white" : "text-stone-300 hover:bg-white/10"
                }`}
              >
                <span>{n.emoji}</span>
                {n.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-5 rounded-2xl bg-white/5 p-3">
          <p className="text-[10px] font-bold tracking-widest text-stone-400 uppercase">
            Waiter calls
          </p>
          {calls.length === 0 ? (
            <p className="mt-1.5 text-[11px] text-stone-500">All attended ✓</p>
          ) : (
            <div className="mt-2 flex flex-col gap-1.5">
              {calls.map((c) => (
                <Link
                  key={c.id}
                  href="/waiter"
                  className="flex items-center justify-between gap-2 rounded-lg bg-white/10 px-2 py-1.5 text-[11px] font-bold"
                >
                  <span className="truncate">{c.label}</span>
                  <CallTimer since={c.since} compact />
                </Link>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={logout}
          className="mt-auto rounded-xl bg-white/10 px-3 py-2.5 text-sm font-semibold text-stone-300"
        >
          Log out
        </button>
      </aside>

      {open && (
        <div
          className="fixed inset-0 z-30 bg-stone-950/50 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <div className="min-w-0 flex-1">
        <button
          onClick={() => setOpen(true)}
          className="sticky top-0 z-20 flex w-full items-center gap-2 border-b border-stone-200 bg-white px-4 py-3 text-sm font-bold text-stone-700 lg:hidden"
        >
          ☰ Menu
          {calls.length > 0 && (
            <span className="ml-auto flex items-center gap-1.5 text-xs text-rose-600">
              {calls.length} call{calls.length > 1 ? "s" : ""} waiting
            </span>
          )}
        </button>
        <CallAlertBar calls={calls} />
        {children}
      </div>
    </div>
  );
}
