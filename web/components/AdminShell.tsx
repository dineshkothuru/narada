"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import CallTimer from "./CallTimer";
import CallAlertBar, { type OpenCall } from "./CallAlertBar";

type Role = "admin" | "kitchen" | "waiter" | "reception" | "cashier";

const I = (p: string) => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="shrink-0"
  >
    {p.split("|").map((d, i) => (
      <path key={i} d={d} />
    ))}
  </svg>
);

const ICONS: Record<string, React.ReactNode> = {
  floor: I("M3 21h18|M5 21V8h14v13|M9 12h6|M9 16h6|M8 8V5a4 4 0 0 1 8 0v3"),
  waiter: I("M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9|M13.7 21a2 2 0 0 1-3.4 0"),
  kitchen: I("M7 21h10|M12 3a4 4 0 0 1 4 4v7H8V7a4 4 0 0 1 4-4z|M8 14v7|M16 14v7"),
  report: I("M3 3v18h18|M7 15l3-4 3 2 4-6"),
  orders: I("M6 2h9l5 5v15H6z|M15 2v5h5|M9 12h6|M9 16h6"),
  menu: I("M7 3v9a3 3 0 0 0 6 0V3|M10 12v9|M18 3v18|M18 3a3 3 0 0 1 0 6h-1"),
  tables: I("M4 10h16|M12 10v10|M7 20l5-4 5 4|M6 4h12l2 6H4z"),
  users: I("M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2|M9 7a4 4 0 1 0 0 .01|M19 8v6|M22 11h-6"),
  counter: I("M3 10h18|M5 10V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v4|M5 10v10h14V10|M9 14h6|M9 17h6"),
  settings: I("M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z|M19.4 13.5a7.7 7.7 0 0 0 0-3l2-1.5-2-3.4-2.3 1a7.7 7.7 0 0 0-2.6-1.5L14 2h-4l-.5 2.6A7.7 7.7 0 0 0 6.9 6.1l-2.3-1-2 3.4 2 1.5a7.7 7.7 0 0 0 0 3l-2 1.5 2 3.4 2.3-1a7.7 7.7 0 0 0 2.6 1.5L10 22h4l.5-2.6a7.7 7.7 0 0 0 2.6-1.5l2.3 1 2-3.4z")
};

// every screen declares which roles may see it — the sidebar shows only what the
// signed-in person can actually open (middleware enforces the same rules server-side)
type NavLink = { href: string; label: string; icon: string; roles: Role[] };
const GROUPS: { label: string; links: NavLink[] }[] = [
  {
    label: "Service",
    links: [
      { href: "/floor", label: "Floor", icon: "floor", roles: ["admin", "reception", "waiter", "cashier"] },
      { href: "/waiter", label: "Waiter", icon: "waiter", roles: ["admin", "waiter"] },
      { href: "/kitchen", label: "Kitchen", icon: "kitchen", roles: ["admin", "kitchen"] },
      { href: "/counter", label: "Counter", icon: "counter", roles: ["admin", "cashier"] },
    ],
  },
  {
    label: "Restaurant",
    links: [
      { href: "/admin/report", label: "Day close", icon: "report", roles: ["admin"] },
      { href: "/admin/orders", label: "Orders", icon: "orders", roles: ["admin"] },
      { href: "/admin/menu", label: "Menu", icon: "menu", roles: ["admin"] },
      { href: "/admin/tables", label: "Tables & QR", icon: "tables", roles: ["admin"] },
    ],
  },
  {
    label: "Setup",
    links: [
      { href: "/admin/users", label: "Users", icon: "users", roles: ["admin"] },
      { href: "/admin", label: "Settings", icon: "settings", roles: ["admin"] },
    ],
  },
];

const ROLE_LABEL: Record<Role, string> = {
  admin: "Owner",
  kitchen: "Kitchen",
  waiter: "Waiter",
  reception: "Reception",
  cashier: "Counter",
};

// Shell for every staff screen: an always-open left rail plus a live call
// watchlist, so an unattended table is visible from anywhere in the back office.
export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [calls, setCalls] = useState<OpenCall[]>([]);
  const [role, setRole] = useState<Role | null>(null);

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
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/me", { cache: "no-store" });
        if (!res.ok) return;
        const d = await res.json();
        if (!cancelled && d.role) setRole(d.role);
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
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

  const visible = (l: NavLink) => !role || l.roles.includes(role);
  const groups = GROUPS.map((g) => ({ ...g, links: g.links.filter(visible) })).filter(
    (g) => g.links.length > 0,
  );
  const flat = groups.flatMap((g) => g.links);
  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
  const watchesCalls = !role || (role !== "kitchen" && role !== "cashier");

  return (
    <div className="flex min-h-dvh bg-[#eeebe8] print:block print:bg-white">
      {/* laptop / tablet: the rail is always open — no hamburger to hunt for */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-stone-200 bg-white md:flex print:hidden">
        <div className="flex h-16 items-center gap-2 border-b border-stone-200 px-5">
          <span className="text-xl">🪈</span>
          <div className="min-w-0">
            <span className="font-display block leading-tight font-semibold text-stone-900">
              Narada
            </span>
            {role && (
              <span className="text-[10px] font-bold tracking-widest text-stone-400 uppercase">
                {ROLE_LABEL[role]}
              </span>
            )}
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {groups.map((g) => (
            <div key={g.label} className="mb-4">
              <div className="px-3 pb-1 text-[10px] font-bold tracking-wider text-stone-400 uppercase">
                {g.label}
              </div>
              {g.links.map((l) => {
                const active = isActive(l.href);
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    className={`mb-0.5 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      active
                        ? "bg-stone-900 text-white shadow-sm"
                        : "text-stone-600 hover:bg-stone-100"
                    }`}
                  >
                    {ICONS[l.icon]}
                    {l.label}
                  </Link>
                );
              })}
            </div>
          ))}

          {watchesCalls && (
            <div className="mt-2 rounded-xl bg-stone-50 p-3 ring-1 ring-stone-200">
              <p className="text-[10px] font-bold tracking-wider text-stone-400 uppercase">
                Waiter calls
              </p>
              {calls.length === 0 ? (
                <p className="mt-1.5 text-[11px] text-stone-400">All attended ✓</p>
              ) : (
                <div className="mt-2 flex flex-col gap-1.5">
                  {calls.map((c) => (
                    <Link
                      key={c.id}
                      href="/waiter"
                      className="flex items-center justify-between gap-2 rounded-lg bg-rose-50 px-2 py-1.5 text-[11px] font-bold text-rose-700 ring-1 ring-rose-200"
                    >
                      <span className="truncate">{c.label}</span>
                      <CallTimer since={c.since} compact />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </nav>

        <div className="border-t border-stone-200 p-3">
          <button
            onClick={logout}
            className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-rose-600 hover:bg-stone-100"
          >
            Log out
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* phone: the same links as a scrolling rail, still always visible */}
        <div className="sticky top-0 z-20 border-b border-stone-200 bg-white md:hidden print:hidden">
          <div className="flex items-center gap-2 px-3 pt-2">
            <span className="font-display text-sm font-semibold text-stone-900">🪈 Narada</span>
            {role && (
              <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-stone-500 uppercase">
                {ROLE_LABEL[role]}
              </span>
            )}
            <button
              onClick={logout}
              className="ml-auto text-xs font-semibold text-rose-600"
            >
              Log out
            </button>
          </div>
          <nav className="flex gap-1.5 overflow-x-auto px-3 py-2 [scrollbar-width:none]">
            {flat.map((l) => {
              const active = isActive(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                    active
                      ? "bg-stone-900 text-white"
                      : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                  }`}
                >
                  {ICONS[l.icon]}
                  {l.label}
                </Link>
              );
            })}
          </nav>
        </div>
        {watchesCalls && <CallAlertBar calls={calls} />}
        {children}
      </div>
    </div>
  );
}
