import { badRequest, HttpError } from "../lib/http.js";
import type { Repos } from "../repositories/index.js";
import { computeBill } from "./billing.js";
import { sessionRounds } from "./sessionDetail.js";
import { lookupTable } from "./tableSession.js";

type BillRepos = Pick<Repos, "sessions" | "outlets" | "tables" | "orders">;

export async function customerBill(repos: BillRepos, sessionId: string, tip: number) {
  const [bill, rounds] = await Promise.all([
    computeBill(repos, sessionId, tip),
    sessionRounds(repos, sessionId),
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
) {
  // Preserve the legacy opt-in ownership check: omitting tableCode remains
  // allowed for existing clients, while a supplied code must own the session.
  if (input.tableCode) {
    const table = await lookupTable(repos, input.tableCode);
    const owned = table ? await repos.sessions.findOwnedByTable(input.sessionId, table.id) : null;
    if (!owned) throw new HttpError(403, "not your table");
  }

  const patch: { service_waived?: boolean; bill_tip?: number } = {};
  if (typeof input.serviceWaived === "boolean") patch.service_waived = input.serviceWaived;
  if (typeof input.tip === "number" && input.tip >= 0 && input.tip <= 100000) {
    patch.bill_tip = Math.round(input.tip);
  }
  if (Object.keys(patch).length === 0) throw badRequest("nothing to update");

  await repos.sessions.update(input.sessionId, patch);
  return computeBill(repos, input.sessionId);
}
