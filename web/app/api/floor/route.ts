import { NextRequest, NextResponse } from "next/server";
import { sbFetch } from "@/lib/supabase-server";
import { computeBill } from "@/lib/billing";
import { deriveTableStatus } from "@/lib/status";

type TableRow = {
  id: string;
  label: string;
  code: string;
  capacity: number;
  zone: string | null;
  needs_cleaning: boolean;
};

type SessionRow = {
  id: string;
  table_id: string;
  created_at: string;
  guests: number | null;
  merged_into: string | null;
  attendant: string | null;
  orders: { id: string; status: string; total_inr: number; lang: string | null }[];
};

// Reception / host view: who is free, who is seated, how long, what they owe.
export async function GET() {
  try {
    const [tables, sessions, calls] = await Promise.all([
      sbFetch<TableRow[]>(`tables?select=id,label,code,capacity,zone,needs_cleaning&order=label`),
      sbFetch<SessionRow[]>(
        `sessions?select=id,table_id,created_at,guests,merged_into,attendant,orders(id,status,total_inr,lang)&status=eq.active`,
      ),
      sbFetch<{ id: string; table_id: string; created_at: string }[]>(
        `waiter_calls?select=id,table_id,created_at&status=eq.open&order=created_at`,
      ),
    ]);

    const callByTable = new Map(calls.map((c) => [c.table_id, c]));
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
        let rounds = 0;
        let readyCount = 0;
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
          readyCount = live.filter((o) => o.status === "ready").length;
          pending = live.length - served;
          rounds = live.length;
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
          status: deriveTableStatus({
            hasSession: Boolean(session),
            needsCleaning: t.needs_cleaning,
            rounds,
            pending,
            due,
          }),
          sessionId: session?.id ?? null,
          isMerged: Boolean(session?.merged_into),
          mergedWith: groupTables,
          since: session?.created_at ?? null,
          guests: session?.guests ?? null,
          rounds,
          served,
          pending,
          ready: readyCount,
          langs: session
            ? [...new Set(session.orders.map((o) => o.lang).filter((l): l is string => Boolean(l)))]
            : [],
          due,
          attendant: session?.attendant ?? null,
          calling: callByTable.has(t.id),
          callId: callByTable.get(t.id)?.id ?? null,
          callSince: callByTable.get(t.id)?.created_at ?? null,
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
        cleaning: rows.filter((r) => r.status === "cleaning").length,
        seated: rows.filter((r) => r.status === "seated").length,
        dining: rows.filter((r) => r.status === "dining").length,
        settling: rows.filter((r) => r.status === "settling").length,
        paid: rows.filter((r) => r.status === "paid").length,
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
    const { action, sessionId, tableId, guests, intoSessionId, attendant } = (await req.json()) as {
      action: "seat" | "merge" | "unmerge" | "attendant" | "clear_table";
      sessionId?: string;
      tableId?: string;
      guests?: number;
      intoSessionId?: string;
      attendant?: string;
    };

    // housekeeping is done — the table goes back into circulation
    if (action === "clear_table" && tableId) {
      await sbFetch(`tables?id=eq.${encodeURIComponent(tableId)}`, {
        method: "PATCH",
        body: JSON.stringify({ needs_cleaning: false }),
      });
      return NextResponse.json({ ok: true });
    }

    if (action === "attendant" && sessionId) {
      await sbFetch(`sessions?id=eq.${encodeURIComponent(sessionId)}`, {
        method: "PATCH",
        body: JSON.stringify({
          attendant:
            typeof attendant === "string" && attendant.trim()
              ? attendant.trim().slice(0, 40)
              : null,
        }),
      });
      return NextResponse.json({ ok: true });
    }

    if (action === "seat" && tableId) {
      const tables = await sbFetch<{ outlet_id: string }[]>(
        `tables?select=outlet_id&id=eq.${encodeURIComponent(tableId)}&limit=1`,
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
          outlet_id: tables[0].outlet_id,
          guests: n,
        }),
      });
      // seating it settles the question of whether it was cleaned
      await sbFetch(`tables?id=eq.${encodeURIComponent(tableId)}&needs_cleaning=eq.true`, {
        method: "PATCH",
        body: JSON.stringify({ needs_cleaning: false }),
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
