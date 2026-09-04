import { useState } from "react";
import { Link } from "react-router";
import AdminShell from "@/components/AdminShell";
import { ask } from "@/components/Dialogs";
import Collapsible from "@/components/Collapsible";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  useAddTables,
  useAdminTables,
  useDeleteTable,
  usePatchTable,
  type AdminTable,
} from "@/api/hooks";

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
                <Button asChild variant="outline" size="sm">
                  <Link to="/admin/qr">QR codes</Link>
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setAddingTable((v) => !v)}>
                  + Add tables
                </Button>
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
                  <FieldGroup className="flex flex-col gap-2">
                    <p className="text-[10px] font-bold tracking-widest text-stone-400 uppercase">
                      Add several
                    </p>
                    <div className="mt-2 flex gap-2">
                      <Input
                        name="count"
                        type="number"
                        min="1"
                        max="100"
                        aria-label="Number of tables"
                        defaultValue={10}
                        className="w-20"
                      />
                      <Input
                        name="prefix"
                        defaultValue="Table"
                        placeholder="Table"
                        aria-label="Table prefix"
                        className="flex-1"
                      />
                    </div>
                    <NativeSelect name="variant" aria-label="Table experience">
                      <NativeSelectOption value="classic">Classic list</NativeSelectOption>
                      <NativeSelectOption value="stories">Feast Stories</NativeSelectOption>
                    </NativeSelect>
                    <Button type="submit" className="mt-2 w-full">
                      Add
                    </Button>
                  </FieldGroup>
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
                  <FieldGroup className="flex flex-col gap-2">
                    <p className="text-[10px] font-bold tracking-widest text-stone-400 uppercase">
                      Add one (custom name)
                    </p>
                    <Input
                      name="label"
                      required
                      aria-label="Table label"
                      placeholder="Terrace 1 / Cabin A / Bar 3"
                    />
                    <NativeSelect name="variant" aria-label="Table experience">
                      <NativeSelectOption value="classic">Classic list</NativeSelectOption>
                      <NativeSelectOption value="stories">Feast Stories</NativeSelectOption>
                    </NativeSelect>
                    <Button type="submit" variant="secondary" className="mt-2 w-full">
                      Add
                    </Button>
                  </FieldGroup>
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
                  outletSlug={data?.outletSlug}
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
  outletSlug,
  onRename,
  onCapacity,
  onVariant,
  onRemove,
}: {
  table: AdminTable;
  outletSlug?: string;
  onRename: (label: string) => void;
  onCapacity: (capacity: number) => void;
  onVariant: (variant: string) => void;
  onRemove: () => void;
}) {
  const href = outletSlug
    ? `/outlet/${encodeURIComponent(outletSlug)}/table/${encodeURIComponent(tb.code)}`
    : null;
  return (
    <div className="flex items-center gap-2 py-2.5 text-sm">
      <Input
        defaultValue={tb.label}
        aria-label={`Table ${tb.label} label`}
        onBlur={(e) => {
          if (e.target.value.trim() && e.target.value !== tb.label) onRename(e.target.value);
        }}
        className="min-w-0 flex-1"
      />
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="hidden font-mono text-[10px] text-stone-400 underline sm:block"
        >
          {href}
        </a>
      ) : (
        <span className="hidden text-[10px] font-semibold text-amber-700 sm:block">
          Outlet URL unavailable
        </span>
      )}
      <Input
        type="number"
        min="1"
        max="50"
        defaultValue={tb.capacity ?? 4}
        title="seats"
        aria-label={`Seats for ${tb.label}`}
        onBlur={(e) => {
          const v = Number(e.target.value);
          if (v > 0 && v !== tb.capacity) onCapacity(v);
        }}
        className="w-14 shrink-0 text-center"
      />
      <NativeSelect
        aria-label={`Experience for ${tb.label}`}
        value={tb.ui_variant}
        onChange={(e) => onVariant(e.target.value)}
      >
        <NativeSelectOption value="classic">Classic</NativeSelectOption>
        <NativeSelectOption value="stories">Stories</NativeSelectOption>
      </NativeSelect>
      <Button variant="ghost" size="sm" onClick={onRemove}>
        Remove
      </Button>
    </div>
  );
}
