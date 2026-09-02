"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
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
    setBusy(false);
    if (res.ok) {
      router.replace(params.get("next") || "/admin");
    } else {
      setError(true);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="w-full max-w-xs rounded-3xl bg-white p-6 shadow-sm ring-1 ring-stone-200"
    >
      <p className="text-4xl">🪈</p>
      <h1 className="font-display mt-2 text-2xl font-semibold text-stone-900">
        Narada Staff
      </h1>
      <p className="mt-1 text-xs text-stone-500">
        Enter the restaurant PIN to open the kitchen &amp; admin panel.
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
