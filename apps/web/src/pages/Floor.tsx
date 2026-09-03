import { useState } from "react";
import AdminShell from "@/components/AdminShell";
import { ask } from "@/components/Dialogs";
import { minutesAgo } from "@narada/shared";
import CallTimer from "@/components/CallTimer";
import { useFloor, useFloorAction, type FloorTable } from "@/api/hooks";

const LANG_BADGE: Record<string, { label: string; cls: string }> = {
  en: { label: "EN", cls: "bg-stone-200 text-stone-700" },
  hi: { label: "हिं", cls: "bg-orange-100 text-orange-700" },
  te: { label: "తె", cls: "bg-teal-100 text-teal-700" },
};

const STATUS = {
  free: { ring: "ring-green-300", chip: "bg-green-100 text-green-700", label: "Free" },
  // paid but still occupied: the party is gathering up and nobody has wiped
  // the table down yet, so it must not be offered to the next guests
  cleaning: {
    ring: "ring-stone-300",
    chip: "bg-stone-200 text-stone-600",
    label: "Cleaning",
  },
  seated: {
    ring: "ring-violet-300",
    chip: "bg-violet-100 text-violet-700",
    label: "Seated · yet to order",
  },
  dining: { ring: "ring-sky-300", chip: "bg-sky-100 text-sky-700", label: "Dining" },
  settling: {
    ring: "ring-amber-400",
    chip: "bg-amber-100 text-amber-800",
    label: "Needs a bill",
  },
  // the counter has raised the bill; the guest has not paid it yet
  billed: {
    ring: "ring-sky-400",
    chip: "bg-sky-100 text-sky-800",
    label: "Billed · awaiting payment",
  },
  paid: {
    ring: "ring-stone-300",
    chip: "bg-stone-200 text-stone-600",
    label: "Paid · clearing",
  },
};

export default function FloorPage() {
  const { data } = useFloor();
  const tables = data?.tables ?? [];
  const stats = data?.stats ?? null;
  const floorAction = useFloorAction();
  const [mergeFrom, setMergeFrom] = useState<FloorTable | null>(null);

  const seat = async (t: FloorTable) => {
    const n = await ask.prompt({
      title: `Seat guests at ${t.label}`,
      message: `This table seats ${t.capacity}.`,
      label: "How many guests",
      defaultValue: String(t.capacity),
      inputMode: "numeric",
      confirmLabel: "Seat them",
    });
    if (n === null) return;
    floorAction.mutate({ action: "seat", tableId: t.id, guests: Number(n) });
  };

  const freeTables = tables.filter((t) => t.status === "free");

  return (
    <AdminShell>
      <main className="console min-h-dvh p-4 sm:p-6">
        <header className="mb-5 flex max-w-5xl flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="font-display text-2xl font-semibold text-slate-900">Narada · Floor</h1>
            <p className="text-xs text-slate-500">
              Seat, release, clean and merge tables · refreshes every 5s
            </p>
          </div>{" "}
        </header>

        {stats && (
          <section className="mb-5 grid max-w-5xl grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Stat
              label="Free tables"
              value={`${stats.free}/${stats.total}`}
              tone="text-green-600"
            />
            <Stat
              label="Seated / dining"
              value={`${stats.seated} / ${stats.dining}`}
              tone="text-sky-600"
            />
            <Stat label="Needs a bill" value={String(stats.settling)} tone="text-amber-600" />
            <Stat label="Awaiting payment" value={String(stats.billed)} tone="text-sky-600" />
            <Stat label="Awaiting cleaning" value={String(stats.cleaning)} tone="text-stone-500" />
            <Stat label="Seats occupied" value={`${stats.seatsBusy}/${stats.seats}`} />
          </section>
        )}

        {mergeFrom && (
          <div className="mb-4 max-w-5xl rounded-2xl bg-stone-900 p-4 text-white">
            <p className="text-sm font-bold">
              Merging {mergeFrom.label} — pick the table it should join:
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {tables
                .filter((t) => t.sessionId && t.id !== mergeFrom.id && !t.isMerged)
                .map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      floorAction.mutate({
                        action: "merge",
                        sessionId: mergeFrom.sessionId!,
                        intoSessionId: t.sessionId!,
                      });
                      setMergeFrom(null);
                    }}
                    className="rounded-full bg-white/15 px-4 py-2 text-xs font-bold ring-1 ring-white/25"
                  >
                    {t.label}
                  </button>
                ))}
              {tables.filter((t) => t.sessionId && t.id !== mergeFrom.id && !t.isMerged).length ===
                0 && (
                <span className="text-xs text-stone-400">
                  No other open table to merge with — seat guests first.
                </span>
              )}
              <button
                onClick={() => setMergeFrom(null)}
                className="rounded-full bg-white/10 px-4 py-2 text-xs font-bold"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="grid max-w-5xl gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tables.map((t) => {
            const st = STATUS[t.status];
            return (
              <article
                key={t.id}
                className={`tone-${t.calling ? "rose" : t.status === "free" ? "emerald" : t.status === "cleaning" ? "slate" : "indigo"} panel panel-lift ${t.calling ? "animate-pulse" : ""}`}
              >
                <div className="panel-head flex items-start justify-between gap-2 px-4 py-3">
                  <div>
                    <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
                      {t.label}
                      {t.langs.map((l) => (
                        <span
                          key={l}
                          title="language this table ordered in"
                          className={`rounded px-1.5 py-0.5 text-[10px] font-extrabold ${LANG_BADGE[l]?.cls ?? "bg-slate-200 text-slate-700"}`}
                        >
                          {LANG_BADGE[l]?.label ?? l.toUpperCase()}
                        </span>
                      ))}
                      {t.isMerged && (
                        <span className="ml-1.5 text-[10px] font-bold text-stone-400">
                          merged →
                        </span>
                      )}
                    </h2>
                    <p className="text-[11px] text-slate-400">
                      {t.capacity} seats
                      {t.zone ? ` · ${t.zone}` : ""}
                      {t.guests ? ` · ${t.guests} guests` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${st.chip}`}
                    >
                      {st.label.toUpperCase()}
                    </span>
                    {t.calling && t.callSince && <CallTimer since={t.callSince} compact />}
                  </div>
                </div>

                <div className="p-4">
                  {t.mergedWith.length > 0 && (
                    <p className="mb-1 text-[11px] font-semibold text-slate-500">
                      Merged with {t.mergedWith.join(", ")}
                    </p>
                  )}

                  {t.status === "seated" && t.rounds === 0 ? (
                    <>
                      <p className="mt-2 text-[11px] text-slate-500">
                        Seated {minutesAgo(t.since!, true)} · nothing ordered yet
                      </p>
                      <button
                        onClick={async () => {
                          const yes = await ask.confirm({
                            title: `Release ${t.label}?`,
                            message: "They never ordered. The table goes back to free.",
                            confirmLabel: "Release it",
                          });
                          if (yes)
                            floorAction.mutate({ action: "release", sessionId: t.sessionId! });
                        }}
                        className="mt-3 rounded-full bg-white px-4 py-2 text-xs font-bold text-slate-700 ring-1 ring-slate-300"
                      >
                        Release
                      </button>
                    </>
                  ) : t.status === "cleaning" ? (
                    <>
                      <p className="mt-2 text-[11px] text-slate-500">
                        Bill settled · clear and wipe before seating anyone
                      </p>
                      <button
                        onClick={() => floorAction.mutate({ action: "clear_table", tableId: t.id })}
                        className="mt-3 w-full rounded-full bg-white py-2.5 text-xs font-bold text-slate-700 ring-1 ring-slate-300 transition active:scale-[0.98]"
                      >
                        ✓ Table ready
                      </button>
                    </>
                  ) : t.status === "free" ? (
                    <button
                      onClick={() => seat(t)}
                      className="mt-3 w-full rounded-full bg-white py-2.5 text-xs font-bold text-slate-700 ring-1 ring-slate-300 transition active:scale-[0.98]"
                    >
                      Seat guests
                    </button>
                  ) : (
                    <>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
                        <span>{minutesAgo(t.since!, true)}</span>
                        <span>
                          {t.served}/{t.rounds} served
                        </span>
                      </div>
                      <div className="mt-3 flex gap-1.5">
                        {t.isMerged ? (
                          <button
                            onClick={() =>
                              floorAction.mutate({ action: "unmerge", sessionId: t.sessionId! })
                            }
                            className="flex-1 rounded-full bg-white py-2 text-[11px] font-bold text-slate-700 ring-1 ring-slate-300"
                          >
                            Unmerge
                          </button>
                        ) : (
                          <button
                            onClick={() => setMergeFrom(t)}
                            className="flex-1 rounded-full bg-white py-2 text-[11px] font-bold text-slate-700 ring-1 ring-slate-300"
                          >
                            Merge
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        {freeTables.length > 0 && (
          <p className="mt-5 max-w-5xl text-center text-[11px] text-slate-400">
            Free right now: {freeTables.map((t) => `${t.label} (${t.capacity})`).join(" · ")}
          </p>
        )}
      </main>
    </AdminShell>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-2xl card-float bg-white p-4 ring-1 ring-stone-200/80">
      <p className="text-[10px] font-bold tracking-widest text-stone-400 uppercase">{label}</p>
      <p className={`font-display mt-1 text-2xl font-semibold ${tone ?? "text-stone-900"}`}>
        {value}
      </p>
    </div>
  );
}
