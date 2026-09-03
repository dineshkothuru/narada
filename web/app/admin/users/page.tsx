"use client";

import AdminShell from "@/components/AdminShell";
import { ask } from "@/components/Dialogs";
import Collapsible from "@/components/Collapsible";
import TipsBoard from "@/components/TipsBoard";
import { useAdminData } from "../useAdminData";

export default function Page() {
  const { staff, addingStaff, setAddingStaff, load, flash, inputCls } = useAdminData();

  return (
    <AdminShell>
      <main className="console min-h-dvh p-4 sm:p-6">
        <div className="flex max-w-5xl flex-col gap-3">
          <header className="mb-1">
            <h1 className="font-display text-2xl font-semibold text-slate-900">
              Users
            </h1>
            <p className="text-xs text-slate-500">Staff logins — each role opens only its own screens</p>
          </header>
      <Collapsible tone="emerald" title="Tips today" hint="per waiter, from settled bills">
        <TipsBoard />
      </Collapsible>

      {/* Staff: each person gets their own PIN; role decides which screens open */}
      <Collapsible
        tone="indigo"
        title="Staff & logins"
        badge={String(staff.length)}
        hint="roles and PINs"
        actions={
          <button
            onClick={() => setAddingStaff((v) => !v)}
            className="rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-600 ring-1 ring-rose-200"
          >
            + Add staff
          </button>
        }
      >
        {addingStaff && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const res = await fetch("/api/admin/staff", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  name: fd.get("name"),
                  role: fd.get("role"),
                  pin: fd.get("pin"),
                }),
              });
              const d = await res.json();
              flash(d.ok ? "Staff added" : (d.error ?? "Failed"));
              setAddingStaff(false);
              load();
            }}
            className="mt-3 grid gap-2 rounded-2xl bg-slate-50 p-3 sm:grid-cols-4"
          >
            <input name="name" required placeholder="Name" className={inputCls} />
            <select name="role" className={inputCls}>
              <option value="waiter">Waiter</option>
              <option value="reception">Reception / host</option>
              <option value="cashier">Counter / cashier</option>
              <option value="kitchen">Kitchen</option>
              <option value="admin">Admin</option>
            </select>
            <input name="pin" required minLength={4} placeholder="PIN (4+ digits)" className={inputCls} />
            <button className="mt-1 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white">
              Add
            </button>
          </form>
        )}
        <div className="mt-2 divide-y divide-slate-100">
          {staff.length === 0 && !addingStaff && (
            <p className="py-3 text-xs text-slate-400">
              No staff yet — everyone is using the owner PIN. Add waiters and cooks so
              each has their own PIN, and their PIN only opens their screen.
            </p>
          )}
          {staff.map((s) => (
            <div key={s.id} className="flex items-center gap-3 py-2.5 text-sm">
              <span
                className={`min-w-0 flex-1 truncate font-medium ${
                  s.active ? "text-slate-800" : "text-slate-400 line-through"
                }`}
              >
                {s.name}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                  s.role === "admin"
                    ? "bg-rose-100 text-rose-700"
                    : s.role === "kitchen"
                      ? "bg-sky-100 text-sky-700"
                      : "bg-green-100 text-green-700"
                }`}
              >
                {s.role}
              </span>
              {/* the PIN itself is no longer stored, only its hash — so it
                  cannot be shown back, only replaced */}
              <button
                onClick={async () => {
                  const pin = await ask.prompt({
                    title: `New PIN for ${s.name}`,
                    message: "They will use this to sign in. It cannot be read back afterwards.",
                    label: "New PIN",
                    placeholder: "at least 4 digits",
                    inputMode: "numeric",
                    required: true,
                    confirmLabel: "Set PIN",
                  });
                  if (pin === null) return;
                  const res = await fetch("/api/admin/staff", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ staffId: s.id, pin }),
                  });
                  const d = await res.json().catch(() => ({}));
                  flash(res.ok ? "PIN updated" : (d.error ?? "Failed"));
                }}
                className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600"
              >
                Reset PIN
              </button>
              <button
                onClick={async () => {
                  await fetch("/api/admin/staff", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ staffId: s.id, active: !s.active }),
                  });
                  flash(s.active ? "Login disabled" : "Login enabled");
                  load();
                }}
                className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                  s.active ? "bg-green-500" : "bg-slate-300"
                }`}
                aria-label={s.active ? "disable login" : "enable login"}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                    s.active ? "left-[22px]" : "left-0.5"
                  }`}
                />
              </button>
              <button
                onClick={async () => {
                  const yes = await ask.confirm({
                    title: `Remove ${s.name}?`,
                    message: "Their PIN stops working immediately.",
                    confirmLabel: "Remove staff",
                    danger: true,
                  });
                  if (!yes) return;
                  await fetch(`/api/admin/staff?id=${s.id}`, { method: "DELETE" });
                  flash("Staff removed");
                  load();
                }}
                className="grid h-7 w-7 place-items-center rounded-full text-xs text-slate-400 hover:bg-rose-50 hover:text-rose-600"
              >
                🗑
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
