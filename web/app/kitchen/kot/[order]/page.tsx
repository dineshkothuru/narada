import { sbFetch } from "@/lib/supabase-server";

// A printable kitchen ticket. Tickets get lost, spiked, or soaked — before
// this, a lost KOT meant reading the order off a screen and writing it out by
// hand. Deliberately plain: it is going to a thermal printer, not a browser.
export default async function KotPage({
  params,
}: {
  params: Promise<{ order: string }>;
}) {
  const { order } = await params;
  const rows = await sbFetch<
    {
      id: string;
      created_at: string;
      placed_by: string | null;
      status: string;
      session: { table: { label: string } | null } | null;
      items: { name: string; qty: number; notes: string | null; status: string }[];
    }[]
  >(
    `orders?select=id,created_at,placed_by,status,session:sessions(table:tables(label)),` +
      `items:order_items(name,qty,notes,status)&id=eq.${encodeURIComponent(order)}&limit=1`,
  );
  const o = rows[0];

  if (!o) {
    return <main className="p-8 font-mono text-sm">Ticket not found.</main>;
  }

  const live = o.items.filter((i) => i.status !== "cancelled");
  const when = new Date(o.created_at);

  return (
    <main className="mx-auto max-w-[80mm] bg-white p-4 font-mono text-[13px] leading-snug text-black">
      <div className="border-b-2 border-dashed border-black pb-2 text-center">
        <p className="text-lg font-bold">{o.session?.table?.label ?? "—"}</p>
        <p className="text-[11px]">
          KOT {o.id.slice(0, 8).toUpperCase()} · {when.toLocaleTimeString("en-IN")}
        </p>
        {o.placed_by && <p className="text-[11px]">for {o.placed_by}</p>}
      </div>

      <ul className="border-b-2 border-dashed border-black py-2">
        {live.map((it, i) => (
          <li key={i} className="flex justify-between gap-3 py-1">
            <span className="font-bold">
              {it.qty} × {it.name}
            </span>
            {it.notes && <span className="text-[11px] italic">{it.notes}</span>}
          </li>
        ))}
        {live.length === 0 && <li className="py-1 italic">Everything on this round was cancelled</li>}
      </ul>

      {o.items.length > live.length && (
        <p className="pt-2 text-[11px] italic">
          {o.items.length - live.length} item(s) cancelled — do not cook
        </p>
      )}

      <p className="pt-3 text-center text-[11px]">reprint · {new Date().toLocaleString("en-IN")}</p>
    </main>
  );
}
