import type { Repos } from "../repositories/index.js";
import { conflict, notFound } from "../lib/http.js";
import { computeBill } from "./billing.js";
import { generateBill, recordPayment, type PaymentInput } from "./settle.js";

// Port of web/app/api/counter/route.ts. The billing desk. Only the counter
// (and the owner) can take money — a waiter carries the bill to the table
// and shares it, but does not settle it.

type CounterBoardRepos = Pick<Repos, "tables" | "sessions" | "outlets">;

export async function counterBoard(repos: CounterBoardRepos, outletId: string) {
  const [tables, sessions] = await Promise.all([
    repos.tables.listAll(outletId),
    repos.sessions.listActiveForCounter(outletId),
  ]);
  const labelOf = new Map(tables.map((t) => [t.id, t.label]));
  const codeOf = new Map(tables.map((t) => [t.id, t.code]));

  const rows = await Promise.all(
    // a merged tab bills through its primary, so only the primary shows here
    sessions
      .filter((s) => !s.merged_into)
      .map(async (s) => {
        const bill = await computeBill(repos, s.id, undefined, outletId).catch(() => null);
        const live = s.orders.filter((o) => o.status !== "cancelled");
        const mergedLabels = sessions
          .filter((o) => o.merged_into === s.id)
          .map((o) => (o.table_id ? labelOf.get(o.table_id) : null))
          .filter((label): label is string => Boolean(label));
        return {
          sessionId: s.id,
          tableId: s.table_id,
          label: s.table_id ? (labelOf.get(s.table_id) ?? "—") : "Takeaway",
          code: s.table_id ? (codeOf.get(s.table_id) ?? null) : null,
          mergedWith: mergedLabels,
          since: s.created_at,
          attendant: s.attendant,
          billNo: s.bill_no,
          rounds: live.length,
          unserved: live.filter((o) => o.status !== "served").length,
          gross: bill?.gross ?? 0,
          discount: bill?.discount ?? 0,
          gst: bill?.gst ?? 0,
          service: bill?.service ?? 0,
          serviceWaived: bill?.serviceWaived ?? false,
          paid: bill?.paid ?? 0,
          due: bill ? Math.max(0, bill.net - bill.paid) : 0,
        };
      }),
  );

  rows.sort((a, b) => a.unserved - b.unserved || b.due - a.due);
  return { tabs: rows };
}

export async function waiveService(
  repos: Pick<Repos, "sessions" | "audit">,
  sessionId: string,
  outletId: string,
  waived?: boolean,
  actor?: { staffId?: string | null; role?: string; actorName?: string },
): Promise<{ ok: true }> {
  const session = await repos.sessions.findById(sessionId, outletId);
  if (!session) {
    throw notFound("unknown session");
  }
  if (session.status !== "active") throw conflict("session is not active");
  if (
    !(await repos.sessions.updateIfUnbilled(
      sessionId,
      { service_waived: Boolean(waived) },
      outletId,
    ))
  ) {
    throw conflict("bill already raised");
  }
  try {
    await repos.audit.create({
      outlet_id: outletId,
      staff_id: actor?.staffId ?? null,
      role: actor?.role ?? "counter",
      actor_name: actor?.actorName ?? "counter",
      action: "service_waived",
      entity_type: "session",
      entity_id: sessionId,
      details: { waived: Boolean(waived) },
    });
  } catch {
    // The waiver committed; audit storage must not make staff retry it.
  }
  return { ok: true };
}

type CounterSettleRepos = Pick<Repos, "sessions" | "outlets" | "payments" | "tables" | "audit">;

export async function counterGenerateBill(
  repos: CounterSettleRepos,
  sessionId: string,
  outletId: string,
  actor?: { staffId?: string | null; role?: string; actorName?: string },
) {
  return generateBill(repos, sessionId, outletId, actor);
}

export async function counterRecordPayment(
  repos: CounterSettleRepos,
  input: PaymentInput,
  outletId: string,
  displayName?: string,
  actor?: { staffId?: string | null; role?: string; actorName?: string },
) {
  return recordPayment(repos, input, outletId, displayName, actor);
}
