import { inr } from "@narada/shared";
import { useTips } from "@/api/hooks";

// Today's tips, per waiter. A tip is paid once against a settled bill and is
// credited to whoever was attending that table, so the board is a straight
// read of the day's closed sessions.
export default function TipsBoard() {
  const { data: tips } = useTips();

  if (!tips) return <p className="text-xs text-stone-400">Loading…</p>;

  if (tips.rows.length === 0 && tips.unassigned === 0) {
    return <p className="text-xs text-stone-400">No tips collected yet today.</p>;
  }

  return (
    <div className="flex flex-col gap-1.5">
      {tips.rows.map((r) => (
        <div
          key={r.attendant}
          className="flex items-center justify-between rounded-xl bg-stone-50 px-3 py-2.5"
        >
          <span className="min-w-0">
            <span className="text-sm font-semibold text-stone-800">👤 {r.attendant}</span>
            <span className="ml-2 text-[11px] text-stone-400">
              {r.tables} table{r.tables === 1 ? "" : "s"}
            </span>
          </span>
          <span className="text-sm font-bold text-green-700">{inr(r.tips)}</span>
        </div>
      ))}

      {tips.unassigned > 0 && (
        <div className="flex items-center justify-between rounded-xl bg-stone-50 px-3 py-2.5">
          <span className="text-sm font-semibold text-stone-500">
            Unassigned
            <span className="ml-2 text-[11px] text-stone-400">
              no attendant was set on the table
            </span>
          </span>
          <span className="text-sm font-bold text-stone-500">{inr(tips.unassigned)}</span>
        </div>
      )}

      <div className="mt-1 flex items-center justify-between px-3">
        <span className="text-[10px] font-bold tracking-widest text-stone-400 uppercase">
          Total today
        </span>
        <span className="font-display text-lg font-semibold text-stone-900">{inr(tips.total)}</span>
      </div>
    </div>
  );
}
