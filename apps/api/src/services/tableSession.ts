import type { Repos } from "../repositories/index.js";

// Port of web/lib/table-session.ts.

export type TableRow = { id: string; outlet_id: string; label: string };
export type SessionRow = { id: string; discount_pct: number; comp_awarded: boolean };

export async function lookupTable(
  repos: Pick<Repos, "tables">,
  tableCode: string,
): Promise<TableRow | null> {
  const row = await repos.tables.findByCode(tableCode);
  return row ? { id: row.id, outlet_id: row.outlet_id, label: row.label } : null;
}

// One active session per table, enforced by a partial unique index; a lost
// insert race falls back to re-reading the winner's row.
export async function getOrCreateSession(
  repos: Pick<Repos, "sessions">,
  table: TableRow,
): Promise<SessionRow> {
  const existing = await repos.sessions.findActiveByTableId(table.id);
  if (existing) return pick(existing);
  try {
    return pick(await repos.sessions.create({ table_id: table.id, outlet_id: table.outlet_id }));
  } catch {
    const winner = await repos.sessions.findActiveByTableId(table.id);
    if (!winner) throw new Error("session create race unresolved");
    return pick(winner);
  }
}

const pick = (s: { id: string; discount_pct: number; comp_awarded: boolean }): SessionRow => ({
  id: s.id,
  discount_pct: s.discount_pct,
  comp_awarded: s.comp_awarded,
});
