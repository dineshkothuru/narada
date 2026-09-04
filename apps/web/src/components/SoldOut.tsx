import { useEffect, useState } from "react";
import { useAvailability, usePatchAvailability } from "@/api/hooks";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
          <Button
            variant={dish.is_available ? "secondary" : "destructive"}
            size="sm"
            key={dish.id}
            onClick={() => patch.mutate({ menuItemId: dish.id, available: !dish.is_available })}
            disabled={patch.isPending}
            className={cn("rounded-full", !dish.is_available && "line-through")}
          >
            {dish.name}
          </Button>
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
    <Alert variant="destructive" className="mb-4 max-w-5xl print:hidden">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <AlertTitle>Menu changed</AlertTitle>
          <AlertDescription>
            <ul className="mt-1.5 flex flex-col gap-1">
              {fresh.slice(0, 5).map((event, index) => {
                const name =
                  typeof event.details?.name === "string" ? event.details.name : "A dish";
                return (
                  <li key={`${event.created_at}-${index}`} className="text-xs text-slate-700">
                    <span className="font-semibold">{name}</span>{" "}
                    {event.action === "dish_sold_out" ? "is sold out" : "is back on"}
                    <span className="text-slate-400"> · {event.role ?? "staff"}</span>
                  </li>
                );
              })}
            </ul>
          </AlertDescription>
        </div>
        <Button variant="secondary" size="sm" onClick={dismiss} className="shrink-0 rounded-full">
          Got it
        </Button>
      </div>
    </Alert>
  );
}
