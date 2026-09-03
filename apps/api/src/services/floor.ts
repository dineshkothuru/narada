import { deriveTableStatus } from "@narada/shared";
import { badRequest, conflict, notFound } from "../lib/http.js";
import type { Repos } from "../repositories/index.js";
import { computeBill } from "./billing.js";

// Port of web/app/api/floor/route.ts. Reception / host view: who is free,
// who is seated, how long, what they owe.

type FloorBoardRepos = Pick<Repos, "tables" | "sessions" | "waiterCalls" | "outlets">;

export async function floorBoard(repos: FloorBoardRepos, outletId: string) {
  const [tables, sessions, calls] = await Promise.all([
    repos.tables.listAll(outletId),
    repos.sessions.listActiveForFloor(outletId),
    repos.waiterCalls.listOpen(outletId),
  ]);

  const callByTable = new Map(calls.map((c) => [c.table_id, c]));
  const byTableId = new Map(tables.map((t) => [t.id, t]));

  // merged sessions bill through their primary; group them for display
  const mergeGroups = new Map<string, string[]>();
  for (const s of sessions) {
    const primary = s.merged_into ?? s.id;
    const arr = mergeGroups.get(primary) ?? [];
    if (s.table_id) arr.push(s.table_id);
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
            const bill = await computeBill(repos, session.id, undefined, outletId);
            due = Math.max(0, bill.net - bill.paid);
          } catch {
            // no bill yet is not an error here, just nothing owed to show
          }
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
            .filter((label): label is string => Boolean(label))
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
          billRaised: Boolean(session?.bill_no),
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
        billNo: session?.bill_no ?? null,
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

  return {
    tables: rows,
    stats: {
      total: rows.length,
      free: rows.filter((r) => r.status === "free").length,
      cleaning: rows.filter((r) => r.status === "cleaning").length,
      seated: rows.filter((r) => r.status === "seated").length,
      dining: rows.filter((r) => r.status === "dining").length,
      settling: rows.filter((r) => r.status === "settling").length,
      billed: rows.filter((r) => r.status === "billed").length,
      paid: rows.filter((r) => r.status === "paid").length,
      seats,
      seatsBusy,
    },
  };
}

export async function clearTable(
  repos: Pick<Repos, "tables"> & {
    waiterCalls?: Pick<Repos["waiterCalls"], "closeOpenByTables">;
  },
  tableId: string,
  outletId: string,
): Promise<{ ok: true }> {
  if (!(await repos.tables.findById(tableId, outletId))) {
    throw notFound("unknown table");
  }
  await repos.tables.setNeedsCleaning([tableId], false, outletId);
  await repos.waiterCalls?.closeOpenByTables([tableId], "table cleared", outletId);
  return { ok: true };
}

type ReleaseRepos = Pick<Repos, "sessions" | "orders" | "waiterCalls" | "audit">;

export async function releaseTable(
  repos: ReleaseRepos,
  sessionId: string,
  outletId: string,
  actor: { staffId: string; role: string; actorName: string },
): Promise<{ ok: true }> {
  const session = await repos.sessions.findById(sessionId, outletId);
  if (!session) throw notFound("unknown session");
  if (session.status !== "active" || session.service_type !== "dine_in" || !session.table_id) {
    throw conflict("only an active dine-in table can be released");
  }
  const closedAt = new Date().toISOString();
  const released = await repos.sessions.releaseIfEmpty(session.id, outletId, closedAt);
  if (!released) throw conflict("this table has ordered — settle it at the counter");
  await repos.waiterCalls.closeOpenByTables([session.table_id], "table released", outletId);
  try {
    await repos.audit.create({
      outlet_id: outletId,
      staff_id: actor.staffId,
      role: actor.role,
      actor_name: actor.actorName,
      action: "table_released",
      entity_type: "session",
      entity_id: session.id,
      details: { tableId: session.table_id },
    });
  } catch {
    // Release committed; do not make a host retry a completed state change.
  }
  return { ok: true };
}

export async function setAttendant(
  repos: Pick<Repos, "sessions">,
  sessionId: string,
  outletId: string,
  attendant?: string,
): Promise<{ ok: true }> {
  if (!(await repos.sessions.findById(sessionId, outletId))) {
    throw notFound("unknown session");
  }
  await repos.sessions.update(
    sessionId,
    {
      attendant: attendant?.trim() ? attendant.trim().slice(0, 40) : null,
    },
    outletId,
  );
  return { ok: true };
}

type SeatRepos = Pick<Repos, "tables" | "sessions">;

// Seating either opens a new tab or, if the table already has one (a second
// scan / a host retry), just updates the guest count on the existing session.
export async function seatTable(
  repos: SeatRepos,
  tableId: string,
  outletId: string,
  guests?: number,
): Promise<{ ok: true; sessionId: string }> {
  const table = await repos.tables.findById(tableId, outletId);
  if (!table) throw notFound("unknown table");

  const n = typeof guests === "number" && guests > 0 && guests <= 50 ? Math.floor(guests) : null;

  const existing = await repos.sessions.findActiveByTableId(tableId, outletId);
  if (existing) {
    await repos.sessions.update(existing.id, { guests: n }, outletId);
    return { ok: true, sessionId: existing.id };
  }

  const created = await repos.sessions.create({
    table_id: tableId,
    outlet_id: table.outlet_id,
    guests: n,
  });
  // seating it settles the question of whether it was cleaned
  await repos.tables.clearCleaningIfNeeded(tableId, outletId);
  return { ok: true, sessionId: created.id };
}

type MergeRepos = Pick<Repos, "sessions">;

// The primary must itself be un-merged, so merge groups stay one level deep —
// joining into an already-merged session re-targets the group's true primary
// instead of nesting.
export async function mergeSession(
  repos: MergeRepos,
  sessionId: string,
  intoSessionId: string,
  outletId: string,
): Promise<{ ok: true; mergedInto: string }> {
  if (sessionId === intoSessionId) throw badRequest("same session");

  const target = await repos.sessions.findById(intoSessionId, outletId);
  if (!target) {
    throw notFound("unknown target");
  }
  const session = await repos.sessions.findById(sessionId, outletId);
  if (!session) {
    throw notFound("unknown session");
  }

  const targetId = target.merged_into ?? target.id;
  if (!(await repos.sessions.mergeIfActiveUnbilled(sessionId, targetId, outletId))) {
    throw conflict("only active unbilled sessions can be merged");
  }
  return { ok: true, mergedInto: targetId };
}

export async function unmergeSession(
  repos: Pick<Repos, "sessions">,
  sessionId: string,
  outletId: string,
): Promise<{ ok: true }> {
  if (!(await repos.sessions.findById(sessionId, outletId))) {
    throw notFound("unknown session");
  }
  if (!(await repos.sessions.unmergeIfActiveUnbilled(sessionId, outletId))) {
    throw conflict("only an active unbilled session can be unmerged");
  }
  return { ok: true };
}
