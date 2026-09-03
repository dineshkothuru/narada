import { useState } from "react";
import { useSearchParams } from "react-router";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ApiError, useLogin } from "@/api/hooks";
import { ROLE_HOME, isStaffRole } from "@/lib/roles";

export default function AdminLoginPage() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [params] = useSearchParams();
  const login = useLogin();

  const denied = params.get("denied");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(false);
    try {
      const d = await login.mutateAsync(pin);
      // land on the screen this role can actually open
      const fallback = isStaffRole(d.role) ? ROLE_HOME[d.role] : "/admin";
      const next = params.get("next") || fallback;
      // hard navigation: a fresh cookie must be picked up, and React Query
      // may still be caching the pre-login 401 for this session
      window.location.replace(next);
    } catch (e) {
      if (e instanceof ApiError) setError(true);
      else throw e;
    }
  };

  return (
    <main className="grid min-h-dvh place-items-center bg-stone-100 px-6">
      <form
        onSubmit={submit}
        className="card-float w-full max-w-xs rounded-3xl bg-white p-6 ring-1 ring-stone-200"
      >
        <p className="text-4xl">🪈</p>
        <h1 className="font-display mt-2 text-2xl font-semibold text-stone-900">Narada Staff</h1>
        <p className="mt-1 text-xs text-stone-500">
          Enter the outlet PIN to open the kitchen &amp; admin panel.
        </p>
        {denied && (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-center text-xs font-semibold text-amber-700">
            Your PIN doesn&apos;t open that screen — sign in with one that does.
          </p>
        )}
        <Input
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="PIN"
          autoFocus
          className="mt-4 h-auto w-full rounded-xl bg-stone-100 px-4 py-3 text-center text-lg font-bold tracking-[0.4em] outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
        />
        {error && (
          <p className="mt-2 text-center text-xs font-semibold text-rose-600">
            Wrong PIN — try again
          </p>
        )}
        <Button
          type="submit"
          disabled={login.isPending || pin.length < 4}
          className="mt-4 h-auto w-full rounded-xl bg-rose-600 px-4 py-3 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-50"
        >
          {login.isPending ? "…" : "Unlock"}
        </Button>
      </form>
    </main>
  );
}
