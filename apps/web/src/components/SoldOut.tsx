import { useEffect, useState } from "react";
import { useAvailability, usePatchAvailability } from "@/api/hooks";

export function SoldOutPanel() {
  const { data } = useAvailability();
  const patch = usePatchAvailability();
  const menu = data?.menu ?? [];
  const out = menu.filter((m) => !m.is_available);

  return (
    <div>
      <p className="mb-2 text-[10px] font-bold tracking-widest text-slate-400 uppercase">
        {out.length > 0
          ? `${out.length} off the menu — tap to put one back`
          : "Tap a dish to take it off the menu"}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {menu.map((dish) => (
          <button
            key={dish.id}
            onClick={() => patch.mutate({ menuItemId: dish.id, available: !dish.is_available })}
            disabled={patch.isPending}
            className={`rounded-full px-3 py-1.5 text-xs font-bold transition active:scale-95 disabled:opacity-60 ${
              dish.is_available
                ? "bg-slate-100 text-slate-600 hover:bg-slate-200"
                : "bg-rose-100 text-rose-700 line-through"
            }`}
          >
            {dish.name}
          </button>
        ))}
      </div>
    </div>
  );
}

export function SoldOutAlerts() {
  const { data } = useAvailability();
  const recent = data?.recent ?? [];
  const [seenAt, setSeenAt] = useState(() => {
    try {
      return localStorage.getItem("narada:soldout-seen") ?? new Date().toISOString();
    } catch {
      return new Date().toISOString();
    }
  });
  const fresh = recent.filter((event) => event.created_at > seenAt);

  useEffect(() => {
    if (!seenAt) setSeenAt(new Date().toISOString());
  }, [seenAt]);
  if (fresh.length === 0) return null;

  const dismiss = () => {
    const latest = fresh.reduce(
      (max, event) => (event.created_at > max ? event.created_at : max),
      seenAt,
    );
    setSeenAt(latest);
    try {
      localStorage.setItem("narada:soldout-seen", latest);
    } catch {
      // Storage is optional; the alert still dismisses for this render.
    }
  };

  return (
    <div className="tone-rose panel panel-lift mb-4 max-w-5xl p-4 print:hidden">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold tracking-widest text-rose-600 uppercase">
            Menu changed
          </p>
          <ul className="mt-1.5 flex flex-col gap-1">
            {fresh.slice(0, 5).map((event, index) => {
              const name = typeof event.details?.name === "string" ? event.details.name : "A dish";
              return (
                <li key={`${event.created_at}-${index}`} className="text-xs text-slate-700">
                  <span className="font-semibold">{name}</span>{" "}
                  {event.action === "dish_sold_out" ? "is sold out" : "is back on"}
                  <span className="text-slate-400"> · {event.role ?? "staff"}</span>
                </li>
              );
            })}
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
