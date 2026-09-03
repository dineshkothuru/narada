export type TipRow = { attendant: string; tips: number; tables: number };

export type SettledSession = {
  tip_to: string | null;
  bill_tip: number | null;
  settled_at: string | null;
};

// The outlet's day, not UTC's — a bill settled at 11pm IST belongs to that
// evening's shift, and in UTC that is already tomorrow.
const IST_OFFSET_MIN = 330;

export function istDayStart(now: Date): Date {
  const ist = new Date(now.getTime() + IST_OFFSET_MIN * 60_000);
  const midnightIst = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate());
  return new Date(midnightIst - IST_OFFSET_MIN * 60_000);
}

// Tips are earned by whoever was attending the table when the bill was frozen.
// Unattributed tips (nobody had claimed the table) are reported separately so
// they are visible rather than silently dropped.
export function tallyTips(sessions: SettledSession[]): {
  rows: TipRow[];
  unassigned: number;
  total: number;
} {
  const byWaiter = new Map<string, TipRow>();
  let unassigned = 0;
  let total = 0;

  for (const s of sessions) {
    const tip = Number(s.bill_tip ?? 0);
    if (!(tip > 0)) continue;
    total += tip;
    const who = s.tip_to?.trim();
    if (!who) {
      unassigned += tip;
      continue;
    }
    const row = byWaiter.get(who) ?? { attendant: who, tips: 0, tables: 0 };
    row.tips += tip;
    row.tables += 1;
    byWaiter.set(who, row);
  }

  const rows = [...byWaiter.values()].sort(
    (a, b) => b.tips - a.tips || a.attendant.localeCompare(b.attendant),
  );
  return { rows, unassigned, total: Math.round(total) };
}
