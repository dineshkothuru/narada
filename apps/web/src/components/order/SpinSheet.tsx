import { WHEEL, type STRINGS } from "@narada/shared";
import { SpinWheel } from "./Games";

type Strings = (typeof STRINGS)["en"];

// The pre-order wheel in its bottom sheet. The prize itself is drawn by the
// server; this only presents the wheel and the result copy.
export default function SpinSheet({
  t,
  spinResult,
  resolveSpin,
  onResult,
  onClose,
}: {
  t: Strings;
  spinResult: number | null;
  resolveSpin: () => Promise<number>;
  onResult: (index: number) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="animate-fade-in absolute inset-0 bg-stone-950/60" onClick={onClose} />
      <div className="animate-sheet-up relative flex flex-col items-center rounded-t-[2rem] bg-white px-5 pt-3 pb-10">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-stone-200" />
        <h2 className="font-display text-2xl font-semibold text-stone-900">{t.spinBanner}</h2>
        <p className="mb-5 text-xs text-stone-400">{t.spinSub}</p>
        <SpinWheel strings={{ spin: t.spin }} resolveSpin={resolveSpin} onResult={onResult} />
        {spinResult !== null && (
          <>
            <div
              className={`animate-pop mt-5 w-full rounded-2xl p-4 text-center text-sm font-semibold ${
                WHEEL[spinResult].reward.type === "discount"
                  ? "bg-rose-50 text-rose-700 ring-1 ring-rose-200"
                  : "bg-stone-50 text-stone-500 ring-1 ring-stone-200"
              }`}
            >
              {WHEEL[spinResult].reward.type === "discount"
                ? t.spinWin.replace(
                    "{pct}",
                    String((WHEEL[spinResult].reward as { pct: number }).pct),
                  )
                : t.spinNone}
            </div>
            <button
              onClick={onClose}
              className="mt-3 rounded-full bg-stone-900 px-8 py-2.5 text-xs font-bold text-white transition active:scale-95"
            >
              ✕
            </button>
          </>
        )}
      </div>
    </div>
  );
}
