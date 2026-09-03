import { badRequest, conflict } from "../lib/http.js";
import type { Repos } from "../repositories/index.js";
import { computeBill } from "./billing.js";
import { sessionRounds } from "./sessionDetail.js";
import { requireSessionForTable } from "./tableSession.js";

type BillRepos = Pick<Repos, "sessions" | "outlets" | "tables" | "orders" | "audit">;

export async function customerBill(
  repos: BillRepos,
  sessionId: string,
  tip: number,
  outletId?: string,
  tableCode?: string,
) {
  let scopedOutletId = outletId;
  if (tableCode) {
    const table = await requireSessionForTable(repos, sessionId, tableCode, outletId);
    scopedOutletId ??= table.outlet_id;
  } else if (!scopedOutletId || !(await repos.sessions.findById(sessionId, scopedOutletId))) {
    throw badRequest("session required");
  }
  if (!scopedOutletId) throw badRequest("session required");
  const primaryId = await repos.sessions.findPrimaryId(sessionId, scopedOutletId);
  if (!primaryId) throw badRequest("session required");
  const [bill, rounds] = await Promise.all([
    computeBill(repos, sessionId, tip, scopedOutletId),
    sessionRounds(repos, primaryId, scopedOutletId),
  ]);
  return { ...bill, rounds };
}

export async function patchCustomerBill(
  repos: BillRepos,
  input: {
    tableCode?: string;
    sessionId: string;
    serviceWaived?: unknown;
    tip?: unknown;
  },
  outletId?: string,
  actor?: { staffId?: string | null; role?: string; actorName?: string },
) {
  let scopedOutletId = outletId;
  if (input.tableCode) {
    const table = await requireSessionForTable(repos, input.sessionId, input.tableCode, outletId);
    scopedOutletId ??= table.outlet_id;
  } else if (!scopedOutletId) {
    throw badRequest("tableCode required");
  } else if (!(await repos.sessions.findById(input.sessionId, scopedOutletId))) {
    throw badRequest("session required");
  }

  // Capability/table ownership is intentionally checked against the session
  // supplied by the customer. A merged child still mutates the primary bill.
  const authorizedSession = await repos.sessions.findById(input.sessionId, scopedOutletId);
  if (!authorizedSession) throw badRequest("session required");
  const primaryId = await repos.sessions.findPrimaryId(input.sessionId, scopedOutletId);
  if (!primaryId) throw badRequest("session required");
  const session = await repos.sessions.findById(primaryId, scopedOutletId);
  if (!session) throw badRequest("session required");
  if (session.status !== "active") throw conflict("session is not active");
  if (session.bill_no) throw conflict("bill already raised");

  const patch: { service_waived?: boolean; bill_tip?: number } = {};
  if (typeof input.serviceWaived === "boolean") patch.service_waived = input.serviceWaived;
  if (typeof input.tip === "number" && input.tip >= 0 && input.tip <= 100000) {
    patch.bill_tip = Math.round(input.tip);
  }
  if (Object.keys(patch).length === 0) throw badRequest("nothing to update");

  if (!(await repos.sessions.updateIfUnbilled(primaryId, patch, scopedOutletId))) {
    throw conflict("bill already raised");
  }
  try {
    await repos.audit.create({
      outlet_id: scopedOutletId,
      staff_id: actor?.staffId ?? null,
      role: actor?.role ?? "customer",
      actor_name: actor?.actorName ?? "guest",
      action: "bill_patched",
      entity_type: "session",
      entity_id: primaryId,
      details: patch,
    });
  } catch {
    // The bill patch committed; do not turn a successful mutation into a 500.
  }
  return computeBill(repos, primaryId, undefined, scopedOutletId);
}
