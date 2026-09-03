import { NextRequest, NextResponse } from "next/server";
import { sbFetch } from "@/lib/supabase-server";
import { computeBill } from "@/lib/billing";

type TableRow = {
  id: string;
  label: string;
  code: string;
  capacity: number;
  zone: string | null;
};

type SessionRow = {
  id: string;
  table_id: string;
  created_at: string;
  guests: number | null;
  merged_into: string | null;
  orders: { id: string; status: string; total_inr: number }[];
};

// Reception / host view: who is free, who is seated, how long, what they owe.
export async function GET() {
  try {
    const [tables, sessions, calls] = await Promise.all([
      sbFetch<TableRow[]>(`tables?select=id,label,code,capacity,zone&order=label`),
      sbFetch<SessionRow[]>(
        `sessions?select=id,table_id,created_at,guests,merged_into,orders(id,status,total_inr)&status=eq.active`,
      ),
      sbFetch<{ table_id: string }[]>(
        `waiter_calls?select=table_id&status=eq.open`,
      ),
    ]);

    const calling = new Set(calls.map((c) => c.table_id));
    const byTableId = new Map(tables.map((t) => [t.id, t]));

    // merged sessions bill through their primary; group them for display
    const mergeGroups = new Map<string, string[]>();
    for (const s of sessions) {
      const primary = s.merged_into ?? s.id;
      const arr = mergeGroups.get(primary) ?? [];
      arr.push(s.table_id);
      mergeGroups.set(primary, arr);
    }

    const rows = await Promise.all(
      tables.map(async (t) => {
        const session = sessions.find((s) => s.table_id === t.id) ?? null;
        let due = 0;
        let served = 0;
        let pending = 0;
        if (session) {
          const primary = session.merged_into ?? session.id;
          if (primary === session.id) {
            try {
              const bill = await computeBill(session.id);
              due = Math.max(0, bill.net - bill.paid);
            } catch {}
          }
          const live = session.orders.filter((o) => o.status !== "cancelled");
          served = live.filter((o) => o.status === "served").length;
          pending = live.length - served;
        }
        const groupTables = session
          ? (mergeGroups.get(session.merged_into ?? session.id) ?? [])
              .filter((id) => id !== t.id)
              .map((id) => byTableId.get(id)?.label)
              .filter(Boolean)
          : [];
        return {
          id: t.id,
          label: t.label,
          code: t.code,
          capacity: t.capacity,
          zone: t.zone,
          status: session ? (pending > 0 ? "dining" : "settling") : "free",
          sessionId: session?.id ?? null,
          isMerged: Boolean(session?.merged_into),
          mergedWith: groupTables,
          since: session?.created_at ?? null,
          guests: session?.guests ?? null,
          rounds: session ? session.orders.length : 0,
          served,
          pending,
          due,
          calling: calling.has(t.id),
        };
      }),
    );

    const seats = tables.reduce((n, t) => n + t.capacity, 0);
    const seatsBusy = rows
      .filter((r) => r.status !== "free")
      .reduce((n, r) => n + (r.guests ?? byTableId.get(r.id)?.capacity ?? 0), 0);

    return NextResponse.json({
      tables: rows,
      stats: {
        total: rows.length,
        free: rows.filter((r) => r.status === "free").length,
        dining: rows.filter((r) => r.status === "dining").length,
        settling: rows.filter((r) => r.status === "settling").length,
        seats,
        seatsBusy,
      },
    });
  } catch (e) {
    console.error("floor:", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}

// Seat guests, merge/unmerge tables.
export async function PATCH(req: NextRequest) {
  try {
    const { action, sessionId, tableId, guests, intoSessionId } =
      (await req.json()) as {
        action: "seat" | "merge" | "unmerge";
        sessionId?: string;
        tableId?: string;
        guests?: number;
        intoSessionId?: string;
      };

    if (action === "seat" && tableId) {
      const tables = await sbFetch<{ restaurant_id: string }[]>(
        `tables?select=restaurant_id&id=eq.${encodeURIComponent(tableId)}&limit=1`,
      );
      if (tables.length === 0) {
        return NextResponse.json({ error: "unknown table" }, { status: 404 });
      }
      const existing = await sbFetch<{ id: string }[]>(
        `sessions?select=id&table_id=eq.${encodeURIComponent(tableId)}&status=eq.active&limit=1`,
      );
      const n =
        typeof guests === "number" && guests > 0 && guests <= 50 ? Math.floor(guests) : null;
      if (existing.length > 0) {
        await sbFetch(`sessions?id=eq.${existing[0].id}`, {
          method: "PATCH",
          body: JSON.stringify({ guests: n }),
        });
        return NextResponse.json({ ok: true, sessionId: existing[0].id });
      }
      const created = await sbFetch<{ id: string }[]>(`sessions`, {
        method: "POST",
        returning: true,
        body: JSON.stringify({
          table_id: tableId,
          restaurant_id: tables[0].restaurant_id,
          guests: n,
        }),
      });
      return NextResponse.json({ ok: true, sessionId: created[0].id });
    }

    if (action === "merge" && sessionId && intoSessionId) {
      if (sessionId === intoSessionId) {
        return NextResponse.json({ error: "same session" }, { status: 400 });
      }
      // primary must itself be un-merged, so groups stay one level deep
      const primary = await sbFetch<{ id: string; merged_into: string | null }[]>(
        `sessions?select=id,merged_into&id=eq.${encodeURIComponent(intoSessionId)}&limit=1`,
      );
      if (primary.length === 0) {
        return NextResponse.json({ error: "unknown target" }, { status: 404 });
      }
      const target = primary[0].merged_into ?? primary[0].id;
      await sbFetch(`sessions?id=eq.${encodeURIComponent(sessionId)}`, {
        method: "PATCH",
        body: JSON.stringify({ merged_into: target }),
      });
      return NextResponse.json({ ok: true, mergedInto: target });
    }

    if (action === "unmerge" && sessionId) {
      await sbFetch(`sessions?id=eq.${encodeURIComponent(sessionId)}`, {
        method: "PATCH",
        body: JSON.stringify({ merged_into: null }),
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "invalid action" }, { status: 400 });
  } catch (e) {
    console.error("floor action:", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
