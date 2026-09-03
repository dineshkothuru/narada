import type { SessionResponse } from "@narada/shared";
import { notFound } from "../lib/http.js";
import type { Repos } from "../repositories/index.js";
import { lookupTable } from "./tableSession.js";

export async function sessionForTable(
  repos: Pick<Repos, "tables" | "sessions" | "outlets">,
  tableCode: string,
): Promise<SessionResponse> {
  const table = await lookupTable(repos, tableCode);
  if (!table) throw notFound("unknown table");
  const session = await repos.sessions.findActiveByTableId(table.id, table.outlet_id);
  return { sessionId: session?.id ?? null };
}
