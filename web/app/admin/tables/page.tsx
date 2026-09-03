"use client";

import Link from "next/link";
import AdminShell from "@/components/AdminShell";
import Collapsible from "@/components/Collapsible";
import { useAdminData } from "../useAdminData";

export default function Page() {
  const { tables, addingTable, setAddingTable, load, flash, inputCls } = useAdminData();

  return (
    <AdminShell>
      <main className="min-h-dvh bg-[#eeebe8] p-4 sm:p-6">
        <div className="flex max-w-5xl flex-col gap-3">
          <header className="mb-1">
            <h1 className="font-display text-2xl font-semibold text-stone-900">Tables</h1>
            <p className="text-xs text-stone-500">
              Add, rename, capacity, per-table experience and QR codes
            </p>
          </header>
          {/* Tables: add/rename/remove, per-table UI experience, QR links */}
          <Collapsible
            title="Tables"
            badge={String(tables.length)}
            hint="capacity, QR links, per-table theme"
            actions={
              <div className="flex items-center gap-2">
                <Link
                  href="/admin/qr"
                  className="rounded-full bg-white px-3 py-1 text-xs font-bold text-stone-600 ring-1 ring-stone-200"
                >
                  QR codes
                </Link>
                <button
                  onClick={() => setAddingTable((v) => !v)}
                  className="rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-600 ring-1 ring-rose-200"
                >
                  + Add tables
                </button>
              </div>
            }
          >
            <p className="text-[11px] text-stone-400">
              Each table gets its own QR link and can run a different experience — Classic list or
              Feast Stories.
            </p>

            {addingTable && (
              <div className="mt-3 grid gap-2 rounded-2xl bg-stone-50 p-3 sm:grid-cols-2">
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    const res = await fetch("/api/admin/tables", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        count: Number(fd.get("count")),
                        prefix: fd.get("prefix"),
                        ui_variant: fd.get("variant"),
                      }),
                    });
                    const d = await res.json();
                    flash(d.ok ? `${d.added} tables added` : (d.error ?? "Failed"));
                    setAddingTable(false);
                    load();
                  }}
                  className="rounded-xl bg-white p-3 ring-1 ring-stone-200"
                >
                  <p className="text-[10px] font-bold tracking-widest text-stone-400 uppercase">
                    Add several
                  </p>
                  <div className="mt-2 flex gap-2">
                    <input
                      name="count"
                      type="number"
                      min="1"
                      max="100"
                      defaultValue={10}
                      className={`${inputCls} !mt-0 w-20`}
                    />
                    <input
                      name="prefix"
                      defaultValue="Table"
                      placeholder="Table"
                      className={`${inputCls} !mt-0 flex-1`}
                    />
                  </div>
                  <select name="variant" className={inputCls}>
                    <option value="classic">Classic list</option>
                    <option value="stories">Feast Stories</option>
                  </select>
                  <button className="mt-2 w-full rounded-xl bg-rose-600 py-2 text-xs font-bold text-white">
                    Add
                  </button>
                </form>

                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    const res = await fetch("/api/admin/tables", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        label: fd.get("label"),
                        ui_variant: fd.get("variant"),
                      }),
                    });
                    const d = await res.json();
                    flash(d.ok ? "Table added" : (d.error ?? "Failed"));
                    setAddingTable(false);
                    load();
                  }}
                  className="rounded-xl bg-white p-3 ring-1 ring-stone-200"
                >
                  <p className="text-[10px] font-bold tracking-widest text-stone-400 uppercase">
                    Add one (custom name)
                  </p>
                  <input
                    name="label"
                    required
                    placeholder="Terrace 1 / Cabin A / Bar 3"
                    className={inputCls}
                  />
                  <select name="variant" className={inputCls}>
                    <option value="classic">Classic list</option>
                    <option value="stories">Feast Stories</option>
                  </select>
                  <button className="mt-2 w-full rounded-xl bg-stone-900 py-2 text-xs font-bold text-white">
                    Add
                  </button>
                </form>
              </div>
            )}

            <div className="mt-2 divide-y divide-stone-100">
              {tables.length === 0 && (
                <p className="py-4 text-center text-xs text-stone-400">
                  No tables yet — add some to generate QR codes.
                </p>
              )}
              {tables.map((tb) => (
                <div key={tb.id} className="flex items-center gap-2 py-2.5 text-sm">
                  <input
                    defaultValue={tb.label}
                    onBlur={async (e) => {
                      if (e.target.value.trim() && e.target.value !== tb.label) {
                        await fetch("/api/admin/tables", {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ tableId: tb.id, label: e.target.value }),
                        });
                        flash("Renamed");
                        load();
                      }
                    }}
                    className="min-w-0 flex-1 rounded-lg bg-transparent px-2 py-1 font-medium text-stone-800 outline-none hover:bg-stone-50 focus:bg-stone-50 focus:ring-2 focus:ring-rose-400"
                  />
                  <a
                    href={`/t/${tb.code}`}
                    target="_blank"
                    className="hidden font-mono text-[10px] text-stone-400 underline sm:block"
                  >
                    /t/{tb.code}
                  </a>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    defaultValue={tb.capacity ?? 4}
                    title="seats"
                    onBlur={async (e) => {
                      const v = Number(e.target.value);
                      if (v > 0 && v !== tb.capacity) {
                        await fetch("/api/admin/tables", {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ tableId: tb.id, capacity: v }),
                        });
                        flash("Saved");
                        load();
                      }
                    }}
                    className="w-14 shrink-0 rounded-lg bg-stone-100 px-2 py-1.5 text-center text-xs font-bold outline-none focus:ring-2 focus:ring-rose-400"
                  />
                  <select
                    value={tb.ui_variant}
                    onChange={async (e) => {
                      await fetch("/api/admin/tables", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ tableId: tb.id, ui_variant: e.target.value }),
                      });
                      flash("Saved");
                      load();
                    }}
                    className="rounded-xl bg-stone-100 px-3 py-2 text-xs font-bold outline-none"
                  >
                    <option value="classic">Classic</option>
                    <option value="stories">Stories</option>
                  </select>
                  <button
                    onClick={async () => {
                      if (!confirm(`Remove ${tb.label}?`)) return;
                      const res = await fetch(`/api/admin/tables?id=${tb.id}`, {
                        method: "DELETE",
                      });
                      const d = await res.json();
                      flash(d.ok ? "Table removed" : (d.reason ?? "Failed"));
                      load();
                    }}
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs text-stone-400 hover:bg-rose-50 hover:text-rose-600"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </Collapsible>
        </div>
      </main>
    </AdminShell>
  );
}
