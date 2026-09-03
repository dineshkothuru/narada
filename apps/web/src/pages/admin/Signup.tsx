import { useState } from "react";
import { Link } from "react-router";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@narada/shared";
import { ApiError, useAddStaff } from "@/api/hooks";
import { ROLE_LABEL, type StaffRole } from "@/lib/roles";
import {
  normalizeUsername,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  USERNAME_PATTERN,
  validUsername,
  codePointLength,
  limitCodePoints,
} from "@/lib/identity";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function StaffSignupPage({ role }: { role: StaffRole }) {
  const addStaff = useAddStaff();
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState(false);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fields = new FormData(form);
    const username = normalizeUsername(String(fields.get("username") ?? "").trim());
    const firstName = String(fields.get("firstName") ?? "").trim();
    const lastName = String(fields.get("lastName") ?? "").trim();
    const password = String(fields.get("password") ?? "");
    setError(null);
    setCreated(false);
    if (!validUsername(username)) {
      setError(
        `Username must be ${USERNAME_MIN_LENGTH}–${USERNAME_MAX_LENGTH} lowercase letters, numbers, ., _, or -`,
      );
      return;
    }
    if (!firstName || codePointLength(firstName) > 60 || codePointLength(lastName) > 60) {
      setError("First name is required (up to 60 characters); last name is optional (up to 60)");
      return;
    }
    const passwordLength = [...password].length;
    if (passwordLength < PASSWORD_MIN_LENGTH || passwordLength > PASSWORD_MAX_LENGTH) {
      setError(`Password must be ${PASSWORD_MIN_LENGTH}–${PASSWORD_MAX_LENGTH} characters`);
      return;
    }
    try {
      await addStaff.mutateAsync({
        username,
        firstName,
        lastName: lastName || undefined,
        password,
        role,
      });
      form.reset();
      setCreated(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not create account");
    }
  };

  return (
    <main className="console grid min-h-dvh place-items-center px-6">
      <form onSubmit={submit} className="panel panel-lift w-full max-w-sm p-6">
        <p className="text-4xl">🪈</p>
        <h1 className="font-display mt-2 text-2xl font-semibold text-stone-900">
          Add {ROLE_LABEL[role]} account
        </h1>
        <p className="mt-1 text-xs text-slate-500">An admin-authorized staff account.</p>
        <label className="mt-4 block text-xs font-semibold text-slate-600">
          Username
          <Input
            name="username"
            required
            minLength={USERNAME_MIN_LENGTH}
            maxLength={USERNAME_MAX_LENGTH}
            pattern={USERNAME_PATTERN.source}
            placeholder="username"
            autoComplete="username"
            className="mt-1"
            onChange={(e) => {
              e.currentTarget.value = normalizeUsername(e.currentTarget.value);
            }}
          />
        </label>
        <label className="mt-2 block text-xs font-semibold text-slate-600">
          First name
          <Input
            name="firstName"
            required
            placeholder="First name"
            className="mt-1"
            onChange={(e) => {
              e.currentTarget.value = limitCodePoints(e.currentTarget.value, 60);
            }}
          />
        </label>
        <label className="mt-2 block text-xs font-semibold text-slate-600">
          Last name <span className="font-normal text-slate-400">(optional)</span>
          <Input
            name="lastName"
            placeholder="Last name"
            className="mt-1"
            onChange={(e) => {
              e.currentTarget.value = limitCodePoints(e.currentTarget.value, 60);
            }}
          />
        </label>
        <label className="mt-2 block text-xs font-semibold text-slate-600">
          Password
          <Input
            name="password"
            type="password"
            required
            minLength={PASSWORD_MIN_LENGTH}
            autoComplete="new-password"
            placeholder="Password (15–128 characters)"
            onChange={(e) => {
              if ([...e.currentTarget.value].length > PASSWORD_MAX_LENGTH) {
                e.currentTarget.value = [...e.currentTarget.value]
                  .slice(0, PASSWORD_MAX_LENGTH)
                  .join("");
              }
            }}
            className="mt-1"
          />
        </label>
        {created && (
          <p className="mt-2 text-center text-xs font-semibold text-green-700">
            Account created. <Link to="/">Return home to sign in</Link>
          </p>
        )}
        {error && <p className="mt-2 text-center text-xs font-semibold text-rose-600">{error}</p>}
        <Button
          type="submit"
          disabled={addStaff.isPending}
          className="mt-4 h-auto w-full rounded-xl bg-rose-600 px-4 py-3 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-50"
        >
          {addStaff.isPending ? "…" : "Create account"}
        </Button>
      </form>
    </main>
  );
}
