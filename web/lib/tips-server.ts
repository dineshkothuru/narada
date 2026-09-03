import "server-only";
import { sbFetch } from "./supabase-server";
import { istDayStart, tallyTips, type SettledSession } from "./tips";

// Today's settled bills, tallied per waiter. The arithmetic lives in ./tips so
// it can be tested without a database.
export async function tipsForDay(now: Date) {
  const since = istDayStart(now).toISOString();
  const sessions = await sbFetch<SettledSession[]>(
    `sessions?select=tip_to,bill_tip,settled_at&settled_at=gte.${encodeURIComponent(since)}`,
  );
  return { since, ...tallyTips(sessions) };
}
