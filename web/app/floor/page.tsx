"use client";

import { useCallback, useEffect, useState } from "react";
import AdminShell from "@/components/AdminShell";
import TableSheet, { shareBillOnWhatsApp } from "@/components/TableSheet";
import { ask } from "@/components/Dialogs";
import { Metric, type Tone } from "@/components/Panel";
import { inr, minutesAgo } from "@/lib/format";
import CallTimer from "@/components/CallTimer";
const LANG_BADGE: Record<string, { label: string; cls: string }> = {
  en: { label: "EN", cls: "bg-slate-200 text-slate-700" },
  hi: { label: "हिं", cls: "bg-slate-100 text-slate-700" },
  te: { label: "తె", cls: "bg-slate-100 text-slate-700" },
};


type FloorTable = {
  id: string;
  label: string;
  code: string;
  capacity: number;
  zone: string | null;
  status:
    | "free"
    | "cleaning"
    | "seated"
    | "dining"
    | "settling"
    | "billed"
    | "paid";
  billNo: string | null;
  sessionId: string | null;
  isMerged: boolean;
  mergedWith: string[];
  since: string | null;
  guests: number | null;
  rounds: number;
  served: number;
  pending: number;
  due: number;
  attendant: string | null;
  langs: string[];
  calling: boolean;
  callId: string | null;
  callSince: string | null;
};

type Stats = {
  total: number;
  free: number;
  cleaning: number;
  billed: number;
  seated: number;
  dining: number;
  settling: number;
  paid: number;
  seats: number;
  seatsBusy: number;
};

const STATUS: Record<
  FloorTable["status"],
  { tone: Tone; chip: string; label: string }
> = {
  free: { tone: "emerald", chip: "bg-emerald-100 text-emerald-700", label: "Free" },
  // paid but still occupied: the party is gathering up and nobody has wiped
  // the table down yet, so it must not be offered to the next guests
  cleaning: { tone: "slate", chip: "bg-slate-200 text-slate-600", label: "Cleaning" },
  seated: {
    tone: "violet",
    chip: "bg-violet-100 text-violet-700",
    label: "Yet to order",
  },
  dining: { tone: "indigo", chip: "bg-indigo-100 text-indigo-700", label: "Dining" },
  settling: { tone: "amber", chip: "bg-amber-100 text-amber-800", label: "Needs a bill" },
  // the counter has raised the bill; the guest has not paid it yet
  billed: { tone: "sky", chip: "bg-sky-100 text-sky-800", label: "Awaiting payment" },
  paid: { tone: "emerald", chip: "bg-emerald-100 text-emerald-700", label: "Paid" },
};

export default function FloorPage() {
  const [tables, setTables] = useState<FloorTable[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [openTable, setOpenTable] = useState<{ id: string; label: string } | null>(null);
  const [mergeFrom, setMergeFrom] = useState<FloorTable | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/floor", { cache: "no-store" });
    if (!res.ok) return;
    const d = await res.json();
    setTables(d.tables ?? []);
    setStats(d.stats ?? null);
  }, []);

  useEffect(() => {
    const tick = () => {
      if (!document.hidden) load();
    };
    const t = setTimeout(tick, 0);
    const iv = setInterval(tick, 5000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearTimeout(t);
      clearInterval(iv);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [load]);

  const act = async (body: Record<string, unknown>) => {
    await fetch("/api/floor", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    load();
  };

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
    act({ action: "seat", tableId: t.id, guests: Number(n) });
  };

  const freeTables = tables.filter((t) => t.status === "free");

  return (
    <AdminShell>
    <main className="console min-h-dvh p-4 sm:p-6">
      <header className="mb-5 flex max-w-5xl flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-semibold text-slate-900">
            Narada · Floor
          </h1>
          <p className="text-xs text-slate-500">
            Live table status, capacity and merges · refreshes every 5s
          </p>
        </div>      </header>

      {stats && (
        <section className="mb-5 grid max-w-5xl grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <Metric tone="emerald" label="Free tables" value={`${stats.free}/${stats.total}`} icon="🪑" />
          <Metric tone="indigo" label="Seated / dining" value={`${stats.seated} / ${stats.dining}`} icon="🍽️" />
          <Metric tone="amber" label="Needs a bill" value={String(stats.settling)} icon="🧾" />
          <Metric tone="sky" label="Awaiting payment" value={String(stats.billed)} icon="💳" />
          <Metric tone="slate" label="Awaiting cleaning" value={String(stats.cleaning)} icon="🧹" />
          <Metric tone="violet" label="Seats occupied" value={`${stats.seatsBusy}/${stats.seats}`} icon="👥" />
        </section>
      )}

      {mergeFrom && (
        <div className="mb-4 max-w-5xl rounded-2xl bg-slate-900 p-4 text-white">
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
                    act({
                      action: "merge",
                      sessionId: mergeFrom.sessionId,
                      intoSessionId: t.sessionId,
                    });
                    setMergeFrom(null);
                  }}
                  className="rounded-full bg-white/15 px-4 py-2 text-xs font-bold ring-1 ring-white/25"
                >
                  {t.label}
                </button>
              ))}
            {tables.filter((t) => t.sessionId && t.id !== mergeFrom.id && !t.isMerged).length === 0 && (
              <span className="text-xs text-slate-400">
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
              className={`tone-${t.calling ? "rose" : st.tone} panel panel-lift ${
                t.calling ? "ring-2 ring-rose-400" : ""
              }`}
            >
              <div className="panel-head flex items-start justify-between gap-2 px-4 py-3">
                <div className="flex min-w-0 items-start gap-2.5">
                  <span className="panel-pill mt-1" />
                  <div className="min-w-0">
                  <h2 className="panel-title flex flex-wrap items-center gap-1.5 text-sm font-bold">
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
                      <span className="ml-1.5 text-[10px] font-bold text-slate-400">
                        merged →
                      </span>
                    )}
                  </h2>
                  <p className="text-[11px] whitespace-nowrap text-slate-400">
                    {t.capacity} seats
                    {t.zone ? ` · ${t.zone}` : ""}
                    {t.guests ? ` · ${t.guests} guests` : ""}
                  </p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span
                    className={`rounded-full px-2 py-0.5 text-center text-[9px] leading-tight font-extrabold ${st.chip}`}
                  >
                    {st.label.toUpperCase()}
                  </span>
                  {t.calling && t.callSince && <CallTimer since={t.callSince} compact />}
                </div>
              </div>

              <div className="p-4">
              {t.mergedWith.length > 0 && (
                <p className="mb-1 text-[11px] font-semibold text-slate-500">
                  🔗 with {t.mergedWith.join(", ")}
                </p>
              )}

              {t.status === "seated" && t.rounds === 0 ? (
                <>
                  <p className="mt-2 text-[11px] text-slate-500">
                    Seated {minutesAgo(t.since!, true)} · nothing ordered yet
                  </p>
                  <div className="mt-3 flex gap-1.5">
                    <button
                      onClick={async () => {
                        const yes = await ask.confirm({
                          title: `Release ${t.label}?`,
                          message: "They never ordered. The table goes back to free.",
                          confirmLabel: "Release it",
                        });
                        if (!yes) return;
                        act({ action: "release", sessionId: t.sessionId });
                      }}
                      className="flex-1 rounded-xl bg-slate-800 py-2 text-[11px] font-bold text-white transition active:scale-[0.98]"
                    >
                      Release
                    </button>
                  </div>
                </>
              ) : t.status === "cleaning" ? (
                <>
                  <p className="mt-2 text-[11px] text-slate-500">
                    Bill settled · waiting for the table to be cleared and wiped
                  </p>
                  <button
                    onClick={() => act({ action: "clear_table", tableId: t.id })}
                    className="mt-3 w-full rounded-xl bg-slate-800 py-2.5 text-xs font-bold text-white transition active:scale-[0.98]"
                  >
                    ✓ Table ready
                  </button>
                </>
              ) : t.status === "free" ? (
                <button
                  onClick={() => seat(t)}
                  className="mt-3 w-full rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white transition active:scale-[0.98]"
                >
                  Seat guests
                </button>
              ) : (
                <>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
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
                        act({ action: "attendant", sessionId: t.sessionId, attendant: who });
                      }}
                      className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                        t.attendant
                          ? "bg-violet-100 text-violet-700"
                          : "bg-slate-100 text-slate-400"
                      }`}
                    >
                      {t.attendant ? `👤 ${t.attendant}` : "+ attendant"}
                    </button>
                    <button
                      onClick={() => setOpenTable({ id: t.sessionId!, label: t.label })}
                      className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-extrabold text-slate-600"
                    >
                      {t.served}/{t.rounds} served · details
                    </button>
                    {t.due > 0 && (
                      <span className="font-bold text-rose-600">due {inr(t.due)}</span>
                    )}
                  </div>
                  <div className="mt-3 flex gap-1.5">
                    {t.isMerged ? (
                      <button
                        onClick={() => act({ action: "unmerge", sessionId: t.sessionId })}
                        className="flex-1 rounded-xl bg-slate-900 py-2 text-[11px] font-bold text-white"
                      >
                        Unmerge
                      </button>
                    ) : (
                      <button
                        onClick={() => setMergeFrom(t)}
                        className="flex-1 rounded-xl bg-slate-900 py-2 text-[11px] font-bold text-white"
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

