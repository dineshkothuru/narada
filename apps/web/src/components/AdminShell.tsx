import { Link, useLocation } from "react-router";
import type { ReactNode } from "react";
import CallAlertBar, { type OpenCall } from "./CallAlertBar";
import { useFloor, useLogout, useMe } from "@/api/hooks";
import { ROLE_LABEL, type StaffRole } from "@/lib/roles";

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

const ICONS: Record<string, ReactNode> = {
  floor: I("M3 21h18|M5 21V8h14v13|M9 12h6|M9 16h6|M8 8V5a4 4 0 0 1 8 0v3"),
  waiter: I("M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9|M13.7 21a2 2 0 0 1-3.4 0"),
  kitchen: I("M7 21h10|M12 3a4 4 0 0 1 4 4v7H8V7a4 4 0 0 1 4-4z|M8 14v7|M16 14v7"),
  orders: I("M6 2h9l5 5v15H6z|M15 2v5h5|M9 12h6|M9 16h6"),
  menu: I("M7 3v9a3 3 0 0 0 6 0V3|M10 12v9|M18 3v18|M18 3a3 3 0 0 1 0 6h-1"),
  tables: I("M4 10h16|M12 10v10|M7 20l5-4 5 4|M6 4h12l2 6H4z"),
  users: I("M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2|M9 7a4 4 0 1 0 0 .01|M19 8v6|M22 11h-6"),
  counter: I("M3 10h18|M5 10V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v4|M5 10v10h14V10|M9 14h6|M9 17h6"),
  settings: I(
    "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z|M19.4 13.5a7.7 7.7 0 0 0 0-3l2-1.5-2-3.4-2.3 1a7.7 7.7 0 0 0-2.6-1.5L14 2h-4l-.5 2.6A7.7 7.7 0 0 0 6.9 6.1l-2.3-1-2 3.4 2 1.5a7.7 7.7 0 0 0 0 3l-2 1.5 2 3.4 2.3-1a7.7 7.7 0 0 0 2.6 1.5L10 22h4l.5-2.6a7.7 7.7 0 0 0 2.6-1.5l2.3 1 2-3.4z",
  ),
};

// every screen declares which roles may see it — the sidebar shows only what the
// signed-in person can actually open (the API enforces the same rules server-side)
type NavLink = { href: string; label: string; icon: string; roles: StaffRole[] };
const GROUPS: { label: string; links: NavLink[] }[] = [
  {
    label: "Service",
    links: [
      {
        href: "/floor",
        label: "Floor",
        icon: "floor",
        roles: ["admin", "reception", "waiter", "cashier"],
      },
      { href: "/waiter", label: "Waiter", icon: "waiter", roles: ["admin", "waiter"] },
      { href: "/kitchen", label: "Kitchen", icon: "kitchen", roles: ["admin", "kitchen"] },
      { href: "/counter", label: "Counter", icon: "counter", roles: ["admin", "cashier"] },
    ],
  },
  {
    label: "Outlet",
    links: [
      { href: "/admin/orders", label: "Orders", icon: "orders", roles: ["admin"] },
      { href: "/admin/report", label: "Day close", icon: "orders", roles: ["admin"] },
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

// Shell for every staff screen: the alert bar stays global, while calls are
// handled on the waiter surface instead of being duplicated in the rail.
export default function AdminShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { data: me } = useMe();
  const role = me?.role ?? null;
  const canUseFloor =
    role === "admin" || role === "reception" || role === "waiter" || role === "cashier";
  const watchesCalls = role === "admin" || role === "reception" || role === "waiter";
  const { data: floor } = useFloor(canUseFloor);
  const logoutMutation = useLogout();

  const calls: OpenCall[] = watchesCalls
    ? (floor?.tables ?? [])
        .filter((t) => t.calling)
        .map((t) => ({
          id: t.id,
          label: t.label,
          since: t.callSince!,
          attendant: t.attendant,
        }))
    : [];

  const logout = async () => {
    await logoutMutation.mutateAsync();
    window.location.replace("/");
  };

  const visible = (l: NavLink) => !role || l.roles.includes(role);
  const groups = GROUPS.map((g) => ({ ...g, links: g.links.filter(visible) })).filter(
    (g) => g.links.length > 0,
  );
  const flat = groups.flatMap((g) => g.links);
  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  return (
    <div className="console flex min-h-dvh print:block print:bg-white">
      {/* laptop / tablet: the rail is always open — no hamburger to hunt for */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-slate-200/70 bg-white/80 backdrop-blur md:flex print:hidden">
        <div className="flex h-16 items-center gap-2 border-b border-slate-200 px-5">
          <span className="text-xl">🪈</span>
          <div className="min-w-0">
            <span className="font-display block leading-tight font-semibold text-slate-900">
              Narada
            </span>
            {role && (
              <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                {ROLE_LABEL[role]}
              </span>
            )}
            {me?.displayName && (
              <span className="block truncate text-[11px] text-slate-500">{me.displayName}</span>
            )}
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {groups.map((g) => (
            <div key={g.label} className="mb-4">
              <div className="px-3 pb-1 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                {g.label}
              </div>
              {g.links.map((l) => {
                const active = isActive(l.href);
                return (
                  <Link
                    key={l.href}
                    to={l.href}
                    className={`mb-0.5 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      active
                        ? "bg-indigo-50 font-semibold text-indigo-700 ring-1 ring-indigo-100"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {ICONS[l.icon]}
                    {l.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="border-t border-slate-200 p-3">
          <button
            onClick={logout}
            className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-rose-600 hover:bg-slate-100"
          >
            Log out
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* phone: the same links as a scrolling rail, still always visible */}
        <div className="sticky top-0 z-20 border-b border-slate-200 bg-white md:hidden print:hidden">
          <div className="flex items-center gap-2 px-3 pt-2">
            <span className="font-display text-sm font-semibold text-slate-900">🪈 Narada</span>
            {role && (
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-slate-500 uppercase">
                {ROLE_LABEL[role]}
              </span>
            )}
            <button onClick={logout} className="ml-auto text-xs font-semibold text-rose-600">
              Log out
            </button>
          </div>
          <nav className="flex gap-1.5 overflow-x-auto px-3 py-2 [scrollbar-width:none]">
            {flat.map((l) => {
              const active = isActive(l.href);
              return (
                <Link
                  key={l.href}
                  to={l.href}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                    active
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
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
