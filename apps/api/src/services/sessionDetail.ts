import type { Repos } from "../repositories/index.js";

// Port of web/lib/session-detail.ts.

export type RoundItem = { id: string; name: string; qty: number; status: string };
export type Round = {
  id: string;
  status: string;
  createdAt: string;
  placedBy: string | null;
  placedVia: string | null;
  totalInr: number;
  items: RoundItem[];
};

// Every round a table has ordered, newest last, with each dish's own progress.
// Staff open this to answer "what did they actually order, and where is it?"
// without leaving the floor.
export async function sessionRounds(
  repos: Pick<Repos, "orders">,
  sessionId: string,
): Promise<Round[]> {
  const rows = await repos.orders.listBySessionWithItems(sessionId);
  return rows
    .filter((o) => o.status !== "cancelled")
    .map((o) => ({
      id: o.id,
      status: o.status,
      createdAt: o.created_at,
      placedBy: o.placed_by,
      placedVia: o.placed_via,
      totalInr: Number(o.total_inr),
      items: o.items ?? [],
    }));
}
