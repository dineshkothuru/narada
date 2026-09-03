import "server-only";
import { sbFetch } from "./supabase-server";

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
export async function sessionRounds(sessionId: string): Promise<Round[]> {
  const rows = await sbFetch<
    {
      id: string;
      status: string;
      created_at: string;
      placed_by: string | null;
      placed_via: string | null;
      total_inr: number;
      items: { id: string; name: string; qty: number; status: string }[];
    }[]
  >(
    `orders?select=id,status,created_at,placed_by,placed_via,total_inr,` +
      `items:order_items(id,name,qty,status)` +
      `&session_id=eq.${encodeURIComponent(sessionId)}&order=created_at`,
  );
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
