import { useState } from "react";
import { Navigate, useParams, useSearchParams } from "react-router";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@narada/shared";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ApiError, useOutletLogin } from "@/api/hooks";
import { ROLE_HOME, safeNext } from "@/lib/roles";
import {
  normalizeUsername,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  USERNAME_PATTERN,
  validUsername,
} from "@/lib/identity";

export default function OutletLoginPage() {
  const { slug } = useParams();
  const scopedLogin = useOutletLogin(slug ?? "");
  const [params] = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const passwordLength = [...password].length;

  if (!slug) return <Navigate to="/" replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const canonicalUsername = normalizeUsername(username.trim());
    if (!validUsername(canonicalUsername)) {
      setError(
        `Username must be ${USERNAME_MIN_LENGTH}–${USERNAME_MAX_LENGTH} lowercase letters, numbers, ., _, or -`,
      );
      return;
    }
    if (passwordLength < PASSWORD_MIN_LENGTH || passwordLength > PASSWORD_MAX_LENGTH) {
      setError(`Password must be ${PASSWORD_MIN_LENGTH}–${PASSWORD_MAX_LENGTH} characters`);
      return;
    }
    setError(null);
    try {
      const d = await scopedLogin.mutateAsync({ username: canonicalUsername, password });
      const next = safeNext(params.get("next"), d.role) ?? ROLE_HOME[d.role];
      window.location.replace(next);
    } catch (e) {
      setError(e instanceof ApiError ? "Invalid username or password" : "Could not sign in");
    }
  };

  return (
    <main className="console grid min-h-dvh place-items-center px-6">
      <form onSubmit={submit} className="panel panel-lift w-full max-w-sm p-6">
        <p className="text-4xl">🪈</p>
        <h1 className="font-display mt-2 text-2xl font-semibold text-slate-900">Staff login</h1>
        <p className="mt-1 text-xs text-slate-500">Use your staff account to continue.</p>
        <label className="mt-4 block text-xs font-semibold text-slate-600">
          Username
          <Input
            name="username"
            value={username}
            onChange={(e) => setUsername(normalizeUsername(e.target.value))}
            placeholder="username"
            autoComplete="username"
            autoFocus
            required
            minLength={USERNAME_MIN_LENGTH}
            maxLength={USERNAME_MAX_LENGTH}
            pattern={USERNAME_PATTERN.source}
            className="mt-1 h-auto w-full rounded-xl bg-slate-50 px-4 py-3 text-center text-lg font-bold outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          />
        </label>
        <label className="mt-2 block text-xs font-semibold text-slate-600">
          Password
          <Input
            name="password"
            type="password"
            value={password}
            onChange={(e) => {
              if ([...e.target.value].length <= PASSWORD_MAX_LENGTH) setPassword(e.target.value);
            }}
            placeholder="Password"
            autoComplete="current-password"
            required
            minLength={PASSWORD_MIN_LENGTH}
            className="mt-1 h-auto w-full rounded-xl bg-slate-50 px-4 py-3 text-center text-lg font-bold outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          />
        </label>
        {error && <p className="mt-2 text-center text-xs font-semibold text-rose-600">{error}</p>}
        <Button
          type="submit"
          disabled={
            scopedLogin.isPending || !username.trim() || passwordLength < PASSWORD_MIN_LENGTH
          }
          className="mt-4 h-auto w-full rounded-xl bg-rose-600 px-4 py-3 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-50"
        >
          {scopedLogin.isPending ? "…" : "Sign in"}
        </Button>
      </form>
    </main>
  );
}
