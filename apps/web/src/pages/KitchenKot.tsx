import { useEffect } from "react";
import { useParams } from "react-router";
import { useKitchenKot } from "@/api/hooks";
import { inr } from "@narada/shared";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";

export default function KitchenKotPage() {
  const { order = "" } = useParams();
  const { data, isError } = useKitchenKot(order);

  useEffect(() => {
    const timer = window.setTimeout(() => window.print(), 350);
    return () => window.clearTimeout(timer);
  }, []);

  if (isError)
    return (
      <Alert variant="destructive" className="m-8 max-w-md">
        <AlertDescription>Could not load this ticket.</AlertDescription>
      </Alert>
    );
  if (!data)
    return (
      <main className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
        <Spinner /> Loading ticket…
      </main>
    );

  return (
    <main className="mx-auto min-h-dvh max-w-md bg-white p-6 text-slate-900 print:p-0">
      <header className="border-b border-dashed border-slate-300 pb-4 text-center">
        <p className="text-xs font-bold tracking-[0.2em] text-slate-500 uppercase">
          Narada · Kitchen
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold">
          KOT #{order.slice(0, 8).toUpperCase()}
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          {data.tableLabel} · {data.placed_by ?? "Guest"}
        </p>
      </header>
      <ul className="divide-y divide-slate-100 py-4">
        {data.items.map((item) => (
          <li key={item.id} className="flex items-start justify-between gap-4 py-3">
            <span className="text-base font-semibold">
              {item.qty} × {item.name}
              {item.notes && (
                <span className="block text-xs font-normal text-warning">Note: {item.notes}</span>
              )}
            </span>
            <span className="text-xs text-slate-500 uppercase">{item.status}</span>
          </li>
        ))}
      </ul>
      <footer className="border-t border-dashed border-slate-300 pt-3 text-right text-xs text-slate-500">
        {inr(data.total_inr)}
      </footer>
    </main>
  );
}
