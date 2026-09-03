"use client";

import { useCallback, useEffect, useState } from "react";

type Dish = { id: string; name: string; is_available: boolean };
type Event = {
  action: "dish_sold_out" | "dish_back_on";
  actor_role: string | null;
  detail: { name?: string } | null;
  created_at: string;
};

function useAvailability() {
  const [menu, setMenu] = useState<Dish[]>([]);
  const [recent, setRecent] = useState<Event[]>([]);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/availability", { cache: "no-store" });
      if (!res.ok) return;
      const d = await res.json();
      setMenu(d.menu ?? []);
      setRecent(d.recent ?? []);
    } catch {}
  }, []);

  useEffect(() => {
    const tick = () => {
      if (!document.hidden) load();
    };
    const t = setTimeout(tick, 0);
    const iv = setInterval(tick, 15_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearTimeout(t);
      clearInterval(iv);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [load]);

  const toggle = async (dish: Dish) => {
    setMenu((prev) =>
      prev.map((m) => (m.id === dish.id ? { ...m, is_available: !m.is_available } : m)),
    );
    await fetch("/api/availability", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ menuItemId: dish.id, available: !dish.is_available }),
    });
    load();
  };

  return { menu, recent, toggle };
}

// The panel itself — usable from the kitchen and from the counter.
export function SoldOutPanel() {
  const { menu, toggle } = useAvailability();
  const out = menu.filter((m) => !m.is_available);

  return (
    <div>
      <p className="mb-2 text-[10px] font-bold tracking-widest text-slate-400 uppercase">
        {out.length > 0
          ? `${out.length} off the menu — tap to put one back`
          : "Tap a dish to take it off the menu"}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {menu.map((m) => (
          <button
            key={m.id}
            onClick={() => toggle(m)}
            className={`rounded-full px-3 py-1.5 text-xs font-bold transition active:scale-95 ${
              m.is_available
                ? "bg-slate-100 text-slate-600 hover:bg-slate-200"
                : "bg-rose-100 text-rose-700 line-through"
            }`}
          >
            {m.name}
          </button>
        ))}
      </div>
    </div>
  );
}

// What the counter and the owner see when the kitchen 86s something: a dish
// running out is news to whoever is taking orders, and they should not learn it
// from a guest asking where their food is.
export function SoldOutAlerts() {
  const { recent } = useAvailability();
  // a device opening for the first time should not be shown a backlog of
  // changes from earlier shifts — only what happens from now on
  const [seenAt, setSeenAt] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    try {
      const stored = localStorage.getItem("narada:soldout-seen");
      if (stored) return stored;
      const now = new Date().toISOString();
      localStorage.setItem("narada:soldout-seen", now);
      return now;
    } catch {
      return new Date().toISOString();
    }
  });

  const fresh = seenAt ? recent.filter((e) => e.created_at > seenAt) : [];
  if (fresh.length === 0) return null;

  const dismiss = () => {
    const latest = fresh[0].created_at;
    setSeenAt(latest);
    try {
      localStorage.setItem("narada:soldout-seen", latest);
    } catch {}
  };

  return (
    <div className="tone-rose panel panel-lift mb-4 max-w-5xl p-4 print:hidden">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold tracking-widest text-rose-600 uppercase">
            🚫 Menu changed
          </p>
          <ul className="mt-1.5 flex flex-col gap-1">
            {fresh.slice(0, 5).map((e, i) => (
              <li key={i} className="text-xs text-slate-700">
                <span className="font-semibold">{e.detail?.name ?? "A dish"}</span>{" "}
                {e.action === "dish_sold_out" ? "is sold out" : "is back on"}
                <span className="text-slate-400">
                  {" "}
                  · {e.actor_role ?? "staff"} ·{" "}
                  {new Date(e.created_at).toLocaleTimeString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <button
          onClick={dismiss}
          className="shrink-0 rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-bold text-slate-600"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
