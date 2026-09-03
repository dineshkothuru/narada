import { istDayStart, tallyTips } from "@narada/shared";
import type { Repos } from "../repositories/index.js";

// Port of web/lib/tips-server.ts. Today's settled bills, tallied per waiter.
// The arithmetic lives in @narada/shared so it can be tested without a
// database.
export async function tipsForDay(repos: Pick<Repos, "sessions">, now: Date) {
  const since = istDayStart(now).toISOString();
  const sessions = await repos.sessions.listSettledSince(since);
  return {
    since,
    ...tallyTips(
      sessions.map((s) => ({
        tip_to: s.tip_to,
        bill_tip: s.bill_tip === null ? null : Number(s.bill_tip),
        settled_at: s.settled_at,
      })),
    ),
  };
}
