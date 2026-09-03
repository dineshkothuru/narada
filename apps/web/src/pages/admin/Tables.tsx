import { useState } from "react";
import { Link } from "react-router";
import AdminShell from "@/components/AdminShell";
import { ask } from "@/components/Dialogs";
import Collapsible from "@/components/Collapsible";
import {
  useAddTables,
  useAdminTables,
  useDeleteTable,
  usePatchTable,
  type AdminTable,
} from "@/api/hooks";

const inputCls =
  "mt-1 w-full rounded-xl bg-stone-100 px-3 py-2.5 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-rose-400";

export default function AdminTablesPage() {
  const { data } = useAdminTables();
  const tables = data?.tables ?? [];
  const addTables = useAddTables();
  const patchTable = usePatchTable();
  const deleteTable = useDeleteTable();
  const [addingTable, setAddingTable] = useState(false);

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

          <Collapsible
            title="Tables"
            badge={String(tables.length)}
            hint="capacity, QR links, per-table theme"
            actions={
              <div className="flex items-center gap-2">
                <Link
                  to="/admin/qr"
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
                    const res = await addTables.mutateAsync({
                      count: Number(fd.get("count")),
                      prefix: String(fd.get("prefix") ?? ""),
                      ui_variant: String(fd.get("variant") ?? "classic"),
                    });
                    ask.toast(res.ok ? `${res.added} tables added` : "Failed");
                    setAddingTable(false);
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
                    const res = await addTables.mutateAsync({
                      label: String(fd.get("label") ?? ""),
                      ui_variant: String(fd.get("variant") ?? "classic"),
                    });
                    ask.toast(res.ok ? "Table added" : "Failed");
                    setAddingTable(false);
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
                <TableRow
                  key={tb.id}
                  table={tb}
                  onRename={(label) => patchTable.mutate({ tableId: tb.id, label })}
                  onCapacity={(capacity) => patchTable.mutate({ tableId: tb.id, capacity })}
                  onVariant={(ui_variant) => patchTable.mutate({ tableId: tb.id, ui_variant })}
                  onRemove={async () => {
                    const yes = await ask.confirm({
                      title: `Remove ${tb.label}?`,
                      message: "Its QR code stops working. Past orders are kept.",
                      confirmLabel: "Remove table",
                      danger: true,
                    });
                    if (!yes) return;
                    const res = await deleteTable.mutateAsync(tb.id);
                    ask.toast(res.ok ? "Table removed" : (res.reason ?? "Failed"));
                  }}
                />
              ))}
            </div>
          </Collapsible>
        </div>
      </main>
    </AdminShell>
  );
}

function TableRow({
  table: tb,
  onRename,
  onCapacity,
  onVariant,
  onRemove,
}: {
  table: AdminTable;
  onRename: (label: string) => void;
  onCapacity: (capacity: number) => void;
  onVariant: (variant: string) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-2 py-2.5 text-sm">
      <input
        defaultValue={tb.label}
        onBlur={(e) => {
          if (e.target.value.trim() && e.target.value !== tb.label) onRename(e.target.value);
        }}
        className="min-w-0 flex-1 rounded-lg bg-transparent px-2 py-1 font-medium text-stone-800 outline-none hover:bg-stone-50 focus:bg-stone-50 focus:ring-2 focus:ring-rose-400"
      />
      <a
        href={`/t/${tb.code}`}
        target="_blank"
        rel="noreferrer"
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
        onBlur={(e) => {
          const v = Number(e.target.value);
          if (v > 0 && v !== tb.capacity) onCapacity(v);
        }}
        className="w-14 shrink-0 rounded-lg bg-stone-100 px-2 py-1.5 text-center text-xs font-bold outline-none focus:ring-2 focus:ring-rose-400"
      />
      <select
        value={tb.ui_variant}
        onChange={(e) => onVariant(e.target.value)}
        className="rounded-xl bg-stone-100 px-3 py-2 text-xs font-bold outline-none"
      >
        <option value="classic">Classic</option>
        <option value="stories">Stories</option>
      </select>
      <button
        onClick={onRemove}
        className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs text-stone-400 hover:bg-rose-50 hover:text-rose-600"
      >
        Remove
      </button>
    </div>
  );
}
