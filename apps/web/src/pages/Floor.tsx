import { useState } from "react";
import AdminShell from "@/components/AdminShell";
import TableSheet, { shareBillOnWhatsApp } from "@/components/TableSheet";
import { ask } from "@/components/Dialogs";
import { inr, minutesAgo } from "@narada/shared";
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
  const [openTable, setOpenTable] = useState<{ id: string; label: string } | null>(null);
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
      <main className="min-h-dvh bg-[#eeebe8] p-4 sm:p-6">
        <header className="mb-5 flex max-w-5xl flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="font-display text-2xl font-semibold text-stone-900">Narada · Floor</h1>
            <p className="text-xs text-stone-500">
              Live table status, capacity and merges · refreshes every 5s
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
                className={`rounded-2xl card-float bg-white p-4 ring-2 ${
                  t.calling ? "animate-pulse ring-4 ring-rose-500 shadow-rose-200" : st.ring
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="flex items-center gap-1.5 text-sm font-bold text-stone-900">
                      {t.label}
                      {t.langs.map((l) => (
                        <span
                          key={l}
                          title="language this table ordered in"
                          className={`rounded px-1.5 py-0.5 text-[10px] font-extrabold ${LANG_BADGE[l]?.cls ?? "bg-stone-200 text-stone-700"}`}
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
                    <p className="text-[11px] text-stone-400">
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

                {t.mergedWith.length > 0 && (
                  <p className="mt-1 text-[11px] font-semibold text-stone-500">
                    🔗 with {t.mergedWith.join(", ")}
                  </p>
                )}

                {t.status === "cleaning" ? (
                  <>
                    <p className="mt-2 text-[11px] text-stone-500">
                      Bill settled · waiting for the table to be cleared and wiped
                    </p>
                    <button
                      onClick={() => floorAction.mutate({ action: "clear_table", tableId: t.id })}
                      className="mt-3 w-full rounded-xl bg-stone-800 py-2.5 text-xs font-bold text-white transition active:scale-[0.98]"
                    >
                      ✓ Table ready
                    </button>
                  </>
                ) : t.status === "free" ? (
                  <button
                    onClick={() => seat(t)}
                    className="mt-3 w-full rounded-xl bg-green-600 py-2.5 text-xs font-bold text-white transition active:scale-[0.98]"
                  >
                    Seat guests
                  </button>
                ) : (
                  <>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-stone-600">
                      <span>{minutesAgo(t.since!, true)}</span>
                      <button
                        onClick={async () => {
                          const who = await ask.prompt({
                            title: `Attendant for ${t.label}`,
                            message: "Leave it empty to unassign the table.",
                            label: "Waiter's name",
                            defaultValue: t.attendant ?? "",
                            confirmLabel: "Assign",
                          });
                          if (who === null) return;
                          floorAction.mutate({
                            action: "attendant",
                            sessionId: t.sessionId!,
                            attendant: who,
                          });
                        }}
                        className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                          t.attendant
                            ? "bg-violet-100 text-violet-700"
                            : "bg-stone-100 text-stone-400"
                        }`}
                      >
                        {t.attendant ? `👤 ${t.attendant}` : "+ attendant"}
                      </button>
                      <button
                        onClick={() => setOpenTable({ id: t.sessionId!, label: t.label })}
                        className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-extrabold text-stone-600"
                      >
                        {t.served}/{t.rounds} served · details
                      </button>
                      {t.due > 0 && (
                        <span className="font-bold text-rose-600">due {inr(t.due)}</span>
                      )}
                    </div>
                    <div className="mt-3 flex gap-1.5">
                      <a
                        href={`/t/${t.code}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 rounded-xl bg-stone-100 py-2 text-center text-[11px] font-bold text-stone-600"
                      >
                        Menu
                      </a>
                      {t.sessionId && (
                        <a
                          href={`/bill/${t.sessionId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex-1 rounded-xl bg-stone-100 py-2 text-center text-[11px] font-bold text-stone-600"
                        >
                          Bill
                        </a>
                      )}
                      {t.isMerged ? (
                        <button
                          onClick={() =>
                            floorAction.mutate({ action: "unmerge", sessionId: t.sessionId! })
                          }
                          className="flex-1 rounded-xl bg-stone-900 py-2 text-[11px] font-bold text-white"
                        >
                          Unmerge
                        </button>
                      ) : (
                        <button
                          onClick={() => setMergeFrom(t)}
                          className="flex-1 rounded-xl bg-stone-900 py-2 text-[11px] font-bold text-white"
                        >
                          Merge
                        </button>
                      )}
                    </div>
                  </>
                )}
              </article>
            );
          })}
        </div>

        {freeTables.length > 0 && (
          <p className="mt-5 max-w-5xl text-center text-[11px] text-stone-400">
            Free right now: {freeTables.map((t) => `${t.label} (${t.capacity})`).join(" · ")}
          </p>
        )}
        {openTable && (
          <TableSheet
            sessionId={openTable.id}
            label={openTable.label}
            onClose={() => setOpenTable(null)}
            onShare={(net) =>
              shareBillOnWhatsApp({
                sessionId: openTable.id,
                label: openTable.label,
                net,
              })
            }
          />
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
