import { useState } from "react";
import AdminShell from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ask } from "@/components/Dialogs";
import { minutesAgo } from "@narada/shared";
import CallTimer from "@/components/CallTimer";
import { useFloor, useFloorAction, type FloorTable } from "@/api/hooks";

const LANG_BADGE: Record<string, string> = {
  en: "EN",
  hi: "हिं",
  te: "తె",
};

const STATUS = {
  free: { ring: "ring-green-300", label: "Free" },
  // paid but still occupied: the party is gathering up and nobody has wiped
  // the table down yet, so it must not be offered to the next guests
  cleaning: {
    ring: "ring-stone-300",
    label: "Cleaning",
  },
  seated: {
    ring: "ring-violet-300",
    label: "Seated · yet to order",
  },
  dining: { ring: "ring-sky-300", label: "Dining" },
  settling: {
    ring: "ring-amber-400",
    label: "Needs a bill",
  },
  // the counter has raised the bill; the guest has not paid it yet
  billed: {
    ring: "ring-sky-400",
    label: "Billed · awaiting payment",
  },
  paid: {
    ring: "ring-stone-300",
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
            <Stat label="Free tables" value={`${stats.free}/${stats.total}`} tone="text-success" />
            <Stat
              label="Seated / dining"
              value={`${stats.seated} / ${stats.dining}`}
              tone="text-info"
            />
            <Stat label="Needs a bill" value={String(stats.settling)} tone="text-warning" />
            <Stat label="Awaiting payment" value={String(stats.billed)} tone="text-info" />
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
                  <Button
                    key={t.id}
                    onClick={() => {
                      floorAction.mutate({
                        action: "merge",
                        sessionId: mergeFrom.sessionId!,
                        intoSessionId: t.sessionId!,
                      });
                      setMergeFrom(null);
                    }}
                    variant="secondary"
                    size="sm"
                  >
                    {t.label}
                  </Button>
                ))}
              {tables.filter((t) => t.sessionId && t.id !== mergeFrom.id && !t.isMerged).length ===
                0 && (
                <span className="text-xs text-stone-400">
                  No other open table to merge with — seat guests first.
                </span>
              )}
              <Button variant="outline" size="sm" onClick={() => setMergeFrom(null)}>
                Cancel
              </Button>
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
                        <Badge variant="secondary" key={l} title="language this table ordered in">
                          {LANG_BADGE[l] ?? l.toUpperCase()}
                        </Badge>
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
                    <Badge
                      variant={
                        t.status === "free"
                          ? "success"
                          : t.status === "settling"
                            ? "warning"
                            : "secondary"
                      }
                    >
                      {st.label.toUpperCase()}
                    </Badge>
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
                      <Button
                        onClick={async () => {
                          const yes = await ask.confirm({
                            title: `Release ${t.label}?`,
                            message: "They never ordered. The table goes back to free.",
                            confirmLabel: "Release it",
                          });
                          if (yes)
                            floorAction.mutate({ action: "release", sessionId: t.sessionId! });
                        }}
                        className="mt-3"
                      >
                        Release
                      </Button>
                    </>
                  ) : t.status === "cleaning" ? (
                    <>
                      <p className="mt-2 text-[11px] text-slate-500">
                        Bill settled · clear and wipe before seating anyone
                      </p>
                      <Button
                        onClick={() => floorAction.mutate({ action: "clear_table", tableId: t.id })}
                        variant="outline"
                        className="mt-3 w-full"
                      >
                        ✓ Table ready
                      </Button>
                    </>
                  ) : t.status === "free" ? (
                    <Button onClick={() => seat(t)} variant="outline" className="mt-3 w-full">
                      Seat guests
                    </Button>
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
                          <Button
                            onClick={() =>
                              floorAction.mutate({ action: "unmerge", sessionId: t.sessionId! })
                            }
                            variant="outline"
                            className="flex-1"
                          >
                            Unmerge
                          </Button>
                        ) : (
                          <Button
                            onClick={() => setMergeFrom(t)}
                            variant="outline"
                            className="flex-1"
                          >
                            Merge
                          </Button>
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
