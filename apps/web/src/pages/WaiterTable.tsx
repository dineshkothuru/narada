import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import AdminShell from "@/components/AdminShell";
import TableSheet from "@/components/TableSheet";
import StaffOrderPad from "@/components/StaffOrderPad";
import { Panel } from "@/components/Panel";
import { ask } from "@/components/Dialogs";
import { useWaiterAction, useWaiterTables, useWaiterMenu } from "@/api/hooks";

export default function WaiterTablePage() {
  const { code = "" } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"details" | "menu">("details");
  const { data: tables, refetch } = useWaiterTables();
  const table = tables?.tables.find((item) => item.code === code);
  const menu = useWaiterMenu(code);
  const action = useWaiterAction();
  const session = table?.session;

  return (
    <AdminShell>
      <main className="console min-h-dvh p-4 sm:p-6">
        <header className="mb-5 flex max-w-5xl items-center justify-between">
          <div>
            <p className="text-xs font-bold tracking-widest text-slate-400 uppercase">
              Waiter workspace
            </p>
            <h1 className="font-display text-2xl font-semibold text-slate-900">
              {table?.label ?? code}
            </h1>
          </div>
          <Link
            to="/waiter"
            className="rounded-full bg-white px-4 py-2 text-xs font-bold text-slate-700 ring-1 ring-slate-300"
          >
            Back
          </Link>
        </header>
        {!table || !session ? (
          <p className="text-sm text-slate-500">That table is no longer open.</p>
        ) : (
          <>
            <div className="mb-4 flex gap-1.5">
              <button
                onClick={() => setTab("details")}
                className={`rounded-full px-4 py-2 text-xs font-bold ${tab === "details" ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}
              >
                Details
              </button>
              <button
                onClick={() => setTab("menu")}
                className={`rounded-full px-4 py-2 text-xs font-bold ${tab === "menu" ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}
              >
                Order pad
              </button>
            </div>
            {tab === "details" ? (
              <TableSheet
                page
                sessionId={session.id}
                tableCode={table.code}
                label={table.label}
                onClose={() => navigate("/waiter")}
                onCancelItem={async (itemId, name) => {
                  const yes = await ask.confirm({
                    title: `Void ${name}?`,
                    message: "Unserved food is removed from the bill and recorded.",
                    confirmLabel: "Void item",
                    danger: true,
                  });
                  if (yes) action.mutate({ action: "cancel_item", itemId });
                }}
              />
            ) : menu.data ? (
              <Panel
                tone="indigo"
                title="Add another round"
                hint="Tap dishes, then send the round to kitchen"
              >
                <StaffOrderPad
                  outletSlug=""
                  tableCode={table.code}
                  sessionId={session.id}
                  menu={menu.data}
                  onPlaced={() => {
                    void refetch();
                    setTab("details");
                  }}
                />
              </Panel>
            ) : (
              <p className="text-sm text-slate-400">Loading menu…</p>
            )}
          </>
        )}
      </main>
    </AdminShell>
  );
}
