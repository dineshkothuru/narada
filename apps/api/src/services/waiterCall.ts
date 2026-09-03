import { notFound } from "../lib/http.js";
import type { Repos } from "../repositories/index.js";
import { lookupTable } from "./tableSession.js";

// Port of web/app/api/waiter-call/route.ts POST. One open call per table.
export async function callWaiter(
  repos: Pick<Repos, "tables" | "waiterCalls" | "outlets">,
  tableCode: string,
): Promise<{ ok: true }> {
  const table = await lookupTable(repos, tableCode);
  if (!table) throw notFound("unknown table");

  const open = await repos.waiterCalls.findOpenByTable(table.id, table.outlet_id);
  if (!open) {
    await repos.waiterCalls.create({ table_id: table.id, outlet_id: table.outlet_id });
  }
  return { ok: true };
}
