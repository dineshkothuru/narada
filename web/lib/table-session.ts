import "server-only";
import { sbFetch } from "./supabase-server";

export type TableRow = { id: string; outlet_id: string; label: string };
export type SessionRow = {
  id: string;
  discount_pct: number;
  comp_awarded: boolean;
};

export async function lookupTable(tableCode: string): Promise<TableRow | null> {
  const rows = await sbFetch<TableRow[]>(
    `tables?select=id,outlet_id,label&code=eq.${encodeURIComponent(tableCode)}&limit=1`,
  );
  return rows[0] ?? null;
}

const SESSION_SELECT = "id,discount_pct,comp_awarded";

// One active session per table, enforced by a partial unique index; a lost
// insert race falls back to re-reading the winner's row.
export async function getOrCreateSession(table: TableRow): Promise<SessionRow> {
  const existing = await sbFetch<SessionRow[]>(
    `sessions?select=${SESSION_SELECT}&table_id=eq.${table.id}&status=eq.active&limit=1`,
  );
  if (existing.length > 0) return existing[0];
  try {
    const created = await sbFetch<SessionRow[]>(`sessions`, {
      method: "POST",
      returning: true,
      body: JSON.stringify({ table_id: table.id, outlet_id: table.outlet_id }),
    });
    return created[0];
  } catch {
    const winner = await sbFetch<SessionRow[]>(
      `sessions?select=${SESSION_SELECT}&table_id=eq.${table.id}&status=eq.active&limit=1`,
    );
    if (winner.length === 0) throw new Error("session create race unresolved");
    return winner[0];
  }
}
