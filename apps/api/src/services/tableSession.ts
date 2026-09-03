import type { Repos } from "../repositories/index.js";
import { notFound } from "../lib/http.js";

// Port of web/lib/table-session.ts.

export type TableRow = { id: string; outlet_id: string; label: string };
export type SessionRow = { id: string; discount_pct: number; comp_awarded: boolean };

export async function lookupTable(
  repos: Pick<Repos, "tables" | "outlets">,
  tableCode: string,
  outletId?: string,
): Promise<TableRow | null> {
  const row = await repos.tables.findByCode(tableCode);
  if (row && outletId && row.outlet_id !== outletId) return null;
  if (row) {
    const outlet = await repos.outlets.findActiveById(row.outlet_id);
    if (!outlet || !outlet.tables_enabled) return null;
  }
  return row ? { id: row.id, outlet_id: row.outlet_id, label: row.label } : null;
}

export async function requireSessionForTable(
  repos: Pick<Repos, "tables" | "sessions" | "outlets">,
  sessionId: string,
  tableCode: string,
  outletId?: string,
): Promise<TableRow> {
  const table = await lookupTable(repos, tableCode, outletId);
  if (!table || !(await repos.sessions.findOwnedByTable(sessionId, table.id, table.outlet_id))) {
    throw notFound("not found");
  }
  return table;
}

// One active session per table, enforced by a partial unique index; a lost
// insert race falls back to re-reading the winner's row.
export async function getOrCreateSession(
  repos: Pick<Repos, "sessions">,
  table: TableRow,
): Promise<SessionRow> {
  const existing = await repos.sessions.findActiveByTableId(table.id, table.outlet_id);
  if (existing) return pick(existing);
  try {
    return pick(await repos.sessions.create({ table_id: table.id, outlet_id: table.outlet_id }));
  } catch {
    const winner = await repos.sessions.findActiveByTableId(table.id, table.outlet_id);
    if (!winner) throw new Error("session create race unresolved");
    return pick(winner);
  }
}

const pick = (s: { id: string; discount_pct: number; comp_awarded: boolean }): SessionRow => ({
  id: s.id,
  discount_pct: s.discount_pct,
  comp_awarded: s.comp_awarded,
});
