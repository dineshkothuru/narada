import type { Repos } from "../repositories/index.js";
import { computeBill } from "./billing.js";
import { generateBill, recordPayment, type PaymentInput } from "./settle.js";

// Port of web/app/api/counter/route.ts. The billing desk. Only the counter
// (and the owner) can take money — a waiter carries the bill to the table
// and shares it, but does not settle it.

type CounterBoardRepos = Pick<Repos, "tables" | "sessions" | "outlets">;

export async function counterBoard(repos: CounterBoardRepos) {
  const [tables, sessions] = await Promise.all([
    repos.tables.listAll(),
    repos.sessions.listActiveForCounter(),
  ]);
  const labelOf = new Map(tables.map((t) => [t.id, t.label]));

  const rows = await Promise.all(
    // a merged tab bills through its primary, so only the primary shows here
    sessions
      .filter((s) => !s.merged_into)
      .map(async (s) => {
        const bill = await computeBill(repos, s.id).catch(() => null);
        const live = s.orders.filter((o) => o.status !== "cancelled");
        const mergedLabels = sessions
          .filter((o) => o.merged_into === s.id)
          .map((o) => labelOf.get(o.table_id))
          .filter((label): label is string => Boolean(label));
        return {
          sessionId: s.id,
          tableId: s.table_id,
          label: labelOf.get(s.table_id) ?? "—",
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
  repos: Pick<Repos, "sessions">,
  sessionId: string,
  waived?: boolean,
): Promise<{ ok: true }> {
  await repos.sessions.update(sessionId, { service_waived: Boolean(waived) });
  return { ok: true };
}

type CounterSettleRepos = Pick<Repos, "sessions" | "outlets" | "payments" | "tables">;

export async function counterGenerateBill(repos: CounterSettleRepos, sessionId: string) {
  return generateBill(repos, sessionId);
}

export async function counterRecordPayment(repos: CounterSettleRepos, input: PaymentInput) {
  return recordPayment(repos, input);
}
