"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

function LoginForm() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const params = useSearchParams();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(false);
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    if (res.ok) {
      const d = (await res.json().catch(() => ({}))) as { role?: string };
      // land on the screen this role can actually open
      const fallback =
        d.role === "kitchen"
          ? "/kitchen"
          : d.role === "waiter"
            ? "/waiter"
            : d.role === "reception"
              ? "/floor"
              : "/admin";
      const next = params.get("next") || fallback;
      // hard navigation: middleware must re-run with the new cookie, and the
      // App Router may still be caching the pre-login redirect for this path
      window.location.replace(next);
      return;
    }
    setBusy(false);
    setError(true);
  };

  return (
    <form
      onSubmit={submit}
      className="card-float w-full max-w-xs rounded-3xl bg-white p-6 ring-1 ring-stone-200"
    >
      <p className="text-4xl">🪈</p>
      <h1 className="font-display mt-2 text-2xl font-semibold text-stone-900">Narada Staff</h1>
      <p className="mt-1 text-xs text-stone-500">
        Enter the outlet PIN to open the kitchen &amp; admin panel.
      </p>
      <input
        type="password"
        inputMode="numeric"
        value={pin}
        onChange={(e) => setPin(e.target.value)}
        placeholder="PIN"
        autoFocus
        className="mt-4 w-full rounded-xl bg-stone-100 px-4 py-3 text-center text-lg font-bold tracking-[0.4em] outline-none focus:ring-2 focus:ring-rose-400"
      />
      {error && (
        <p className="mt-2 text-center text-xs font-semibold text-rose-600">
          Wrong PIN — try again
        </p>
      )}
      <button
        type="submit"
        disabled={busy || pin.length < 4}
        className="mt-4 w-full rounded-xl bg-rose-600 px-4 py-3 text-sm font-bold text-white transition active:scale-[0.98] disabled:opacity-50"
      >
        {busy ? "…" : "Unlock"}
      </button>
    </form>
  );
}

export default function AdminLoginPage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-stone-100 px-6">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
