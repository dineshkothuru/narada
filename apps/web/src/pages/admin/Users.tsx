import { useState } from "react";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@narada/shared";
import AdminShell from "@/components/AdminShell";
import { ask } from "@/components/Dialogs";
import Collapsible from "@/components/Collapsible";
import TipsBoard from "@/components/TipsBoard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
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
              <Button variant="secondary" size="sm" onClick={() => setAddingStaff((v) => !v)}>
                + Add staff
              </Button>
            }
          >
            {addingStaff && (
              <form onSubmit={(e) => submit(e)} className="mt-3">
                <FieldGroup className="grid gap-2 rounded-2xl bg-stone-50 p-3 sm:grid-cols-3">
                  <IdentityFields />
                  <NativeSelect name="role" aria-label="Role" defaultValue="waiter">
                    <NativeSelectOption value="waiter">Waiter</NativeSelectOption>
                    <NativeSelectOption value="reception">Reception / host</NativeSelectOption>
                    <NativeSelectOption value="cashier">Counter / cashier</NativeSelectOption>
                    <NativeSelectOption value="kitchen">Kitchen</NativeSelectOption>
                    <NativeSelectOption value="admin">Admin</NativeSelectOption>
                  </NativeSelect>
                  <PasswordField required />
                  <Button type="submit" className="sm:col-span-3">
                    Add
                  </Button>
                </FieldGroup>
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
                      <Badge variant={s.role === "admin" ? "destructive" : "secondary"}>
                        {s.role}
                      </Badge>
                      <Field orientation="horizontal" className="w-auto items-center gap-2">
                        <Switch
                          id={`active-${s.id}`}
                          checked={s.active}
                          onCheckedChange={(active) => patchStaff.mutate({ staffId: s.id, active })}
                          aria-label={s.active ? "disable login" : "enable login"}
                        />
                        <FieldLabel htmlFor={`active-${s.id}`} className="sr-only">
                          Account active
                        </FieldLabel>
                      </Field>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setEditingId(editingId === s.id ? null : s.id)}
                      >
                        {setupRequired ? "Complete setup" : "Edit"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
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
                        aria-label={`Remove ${displayName}`}
                      >
                        🗑
                      </Button>
                    </div>
                    {editingId === s.id && (
                      <form onSubmit={(e) => submit(e, s.id, setupRequired)} className="mt-2">
                        <FieldGroup className="grid gap-2 rounded-2xl bg-stone-50 p-3 sm:grid-cols-3">
                          <IdentityFields staff={s} />
                          <PasswordField required={setupRequired} />
                          <Button type="submit" variant="secondary">
                            {setupRequired ? "Complete setup" : "Save"}
                          </Button>
                        </FieldGroup>
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
      <Input
        name="username"
        required
        minLength={USERNAME_MIN_LENGTH}
        maxLength={USERNAME_MAX_LENGTH}
        pattern={USERNAME_PATTERN.source}
        defaultValue={staff?.username ?? ""}
        placeholder="username"
        aria-label="Username"
        onChange={(e) => {
          e.currentTarget.value = normalizeUsername(e.currentTarget.value);
        }}
      />
      <Input
        name="firstName"
        required
        defaultValue={staff?.firstName ?? ""}
        placeholder="First name"
        aria-label="First name"
        onChange={(e) => {
          e.currentTarget.value = limitCodePoints(e.currentTarget.value, 60);
        }}
      />
      <Input
        name="lastName"
        defaultValue={staff?.lastName ?? ""}
        placeholder="Last name (optional)"
        aria-label="Last name"
        onChange={(e) => {
          e.currentTarget.value = limitCodePoints(e.currentTarget.value, 60);
        }}
      />
    </>
  );
}

function PasswordField({ required = false }: { required?: boolean }) {
  return (
    <Input
      name="password"
      type="password"
      required={required}
      minLength={PASSWORD_MIN_LENGTH}
      autoComplete="new-password"
      placeholder={required ? "Password (15–128 characters)" : "New password (optional)"}
      aria-label={required ? "Password" : "New password"}
      onChange={(e) => {
        if ([...e.currentTarget.value].length > PASSWORD_MAX_LENGTH) {
          e.currentTarget.value = [...e.currentTarget.value].slice(0, PASSWORD_MAX_LENGTH).join("");
        }
      }}
    />
  );
}
