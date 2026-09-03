import { useState } from "react";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@narada/shared";
import AdminShell from "@/components/AdminShell";
import { ask } from "@/components/Dialogs";
import Collapsible from "@/components/Collapsible";
import TipsBoard from "@/components/TipsBoard";
import { useAddStaff, useAdminStaff, useDeleteStaff, usePatchStaff } from "@/api/hooks";
import {
  normalizeUsername,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  USERNAME_PATTERN,
  validUsername,
  codePointLength,
  limitCodePoints,
} from "@/lib/identity";

const inputCls =
  "mt-1 w-full rounded-xl bg-stone-100 px-3 py-2.5 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-rose-400";

export default function AdminUsersPage() {
  const { data } = useAdminStaff();
  const staff = data?.staff ?? [];
  const addStaff = useAddStaff();
  const patchStaff = usePatchStaff();
  const deleteStaff = useDeleteStaff();
  const [addingStaff, setAddingStaff] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const submit = async (
    e: React.FormEvent<HTMLFormElement>,
    staffId?: string,
    setupRequired = false,
  ) => {
    e.preventDefault();
    const fields = new FormData(e.currentTarget);
    const username = normalizeUsername(String(fields.get("username") ?? "").trim());
    const firstName = String(fields.get("firstName") ?? "").trim();
    const lastName = String(fields.get("lastName") ?? "").trim();
    const password = String(fields.get("password") ?? "");
    if (
      !validUsername(username) ||
      !firstName ||
      codePointLength(firstName) > 60 ||
      codePointLength(lastName) > 60
    ) {
      ask.toast("Enter a valid username and first name; names are at most 60 characters");
      return;
    }
    if ([...password].length < PASSWORD_MIN_LENGTH || [...password].length > PASSWORD_MAX_LENGTH) {
      if (staffId && !password && !setupRequired) {
        // Existing accounts may keep their password while their identity is edited.
      } else {
        ask.toast(`Password must be ${PASSWORD_MIN_LENGTH}–${PASSWORD_MAX_LENGTH} characters`);
        return;
      }
    }
    try {
      if (staffId) {
        await patchStaff.mutateAsync({
          staffId,
          username,
          firstName,
          lastName: lastName || null,
          ...(password ? { password } : {}),
        });
        setEditingId(null);
        ask.toast("Staff updated");
      } else {
        await addStaff.mutateAsync({
          username,
          firstName,
          lastName: lastName || undefined,
          role: String(fields.get("role")),
          password,
        });
        e.currentTarget.reset();
        setAddingStaff(false);
        ask.toast("Staff added");
      }
    } catch {
      ask.toast("Could not save staff account");
    }
  };

  return (
    <AdminShell>
      <main className="min-h-dvh bg-[#eeebe8] p-4 sm:p-6">
        <div className="flex max-w-5xl flex-col gap-3">
          <header className="mb-1">
            <h1 className="font-display text-2xl font-semibold text-stone-900">Users</h1>
            <p className="text-xs text-stone-500">Staff accounts and access setup</p>
          </header>

          <Collapsible title="Tips today" hint="per waiter, from settled bills">
            <TipsBoard />
          </Collapsible>

          <Collapsible
            title="Staff & logins"
            badge={String(staff.length)}
            hint="usernames, roles and setup"
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
                onSubmit={(e) => submit(e)}
                className="mt-3 grid gap-2 rounded-2xl bg-stone-50 p-3 sm:grid-cols-3"
              >
                <IdentityFields />
                <select name="role" className={inputCls} defaultValue="waiter">
                  <option value="waiter">Waiter</option>
                  <option value="reception">Reception / host</option>
                  <option value="cashier">Counter / cashier</option>
                  <option value="kitchen">Kitchen</option>
                  <option value="admin">Admin</option>
                </select>
                <PasswordField required />
                <button className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white sm:col-span-3">
                  Add
                </button>
              </form>
            )}
            <div className="mt-2 divide-y divide-stone-100">
              {staff.length === 0 && !addingStaff && (
                <p className="py-3 text-xs text-stone-400">No staff accounts yet.</p>
              )}
              {staff.map((s) => {
                const displayName =
                  s.displayName ||
                  [s.firstName, s.lastName].filter(Boolean).join(" ") ||
                  "Setup required";
                const username = s.username ?? "";
                const setupRequired = Boolean(s.needsSetup || !username || !s.firstName);
                return (
                  <div key={s.id} className="py-2.5 text-sm">
                    <div className="flex items-center gap-3">
                      <span
                        className={`min-w-0 flex-1 ${s.active ? "text-stone-800" : "text-stone-400 line-through"}`}
                      >
                        <span className="block truncate font-semibold">{displayName}</span>
                        <span className="block truncate text-xs text-stone-400">
                          {username ? `@${username}` : "Setup required"}
                        </span>
                      </span>
                      <span className="text-[10px] font-bold text-stone-500">
                        {setupRequired ? "Setup needed" : "Ready"}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${s.role === "admin" ? "bg-rose-100 text-rose-700" : "bg-stone-100 text-stone-600"}`}
                      >
                        {s.role}
                      </span>
                      <button
                        onClick={() => patchStaff.mutate({ staffId: s.id, active: !s.active })}
                        className={`relative h-6 w-11 shrink-0 rounded-full transition ${s.active ? "bg-green-500" : "bg-stone-300"}`}
                        aria-label={s.active ? "disable login" : "enable login"}
                      >
                        <span
                          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${s.active ? "left-[22px]" : "left-0.5"}`}
                        />
                      </button>
                      <button
                        onClick={() => setEditingId(editingId === s.id ? null : s.id)}
                        className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-bold text-stone-600"
                      >
                        {setupRequired ? "Complete setup" : "Edit"}
                      </button>
                      <button
                        onClick={async () => {
                          const yes = await ask.confirm({
                            title: `Remove ${displayName}?`,
                            message: "Their password stops working immediately.",
                            confirmLabel: "Remove staff",
                            danger: true,
                          });
                          if (!yes) return;
                          await deleteStaff.mutateAsync(s.id);
                          ask.toast("Staff removed");
                        }}
                        className="grid h-7 w-7 place-items-center rounded-full text-xs text-stone-400 hover:bg-rose-50 hover:text-rose-600"
                        aria-label={`Remove ${displayName}`}
                      >
                        🗑
                      </button>
                    </div>
                    {editingId === s.id && (
                      <form
                        onSubmit={(e) => submit(e, s.id, setupRequired)}
                        className="mt-2 grid gap-2 rounded-2xl bg-stone-50 p-3 sm:grid-cols-3"
                      >
                        <IdentityFields staff={s} />
                        <PasswordField required={setupRequired} />
                        <button className="rounded-xl bg-stone-900 px-4 py-2 text-xs font-bold text-white">
                          {setupRequired ? "Complete setup" : "Save"}
                        </button>
                      </form>
                    )}
                  </div>
                );
              })}
            </div>
          </Collapsible>
        </div>
      </main>
    </AdminShell>
  );
}

function IdentityFields({
  staff,
}: {
  staff?: { username: string | null; firstName: string | null; lastName: string | null };
}) {
  return (
    <>
      <input
        name="username"
        required
        minLength={USERNAME_MIN_LENGTH}
        maxLength={USERNAME_MAX_LENGTH}
        pattern={USERNAME_PATTERN.source}
        defaultValue={staff?.username ?? ""}
        placeholder="username"
        className={inputCls}
        onChange={(e) => {
          e.currentTarget.value = normalizeUsername(e.currentTarget.value);
        }}
      />
      <input
        name="firstName"
        required
        defaultValue={staff?.firstName ?? ""}
        placeholder="First name"
        className={inputCls}
        onChange={(e) => {
          e.currentTarget.value = limitCodePoints(e.currentTarget.value, 60);
        }}
      />
      <input
        name="lastName"
        defaultValue={staff?.lastName ?? ""}
        placeholder="Last name (optional)"
        className={inputCls}
        onChange={(e) => {
          e.currentTarget.value = limitCodePoints(e.currentTarget.value, 60);
        }}
      />
    </>
  );
}

function PasswordField({ required = false }: { required?: boolean }) {
  return (
    <input
      name="password"
      type="password"
      required={required}
      minLength={PASSWORD_MIN_LENGTH}
      autoComplete="new-password"
      placeholder={required ? "Password (15–128 characters)" : "New password (optional)"}
      onChange={(e) => {
        if ([...e.currentTarget.value].length > PASSWORD_MAX_LENGTH) {
          e.currentTarget.value = [...e.currentTarget.value].slice(0, PASSWORD_MAX_LENGTH).join("");
        }
      }}
      className={inputCls}
    />
  );
}
