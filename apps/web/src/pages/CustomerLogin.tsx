import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@narada/shared";
import { ApiError, useCustomerLogin } from "@/api/hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { normalizePhone, PHONE_PATTERN, validPhone } from "@/lib/phone";
import { safeCustomerNext } from "@/lib/customerAuth";

export default function CustomerLoginPage() {
  const login = useCustomerLogin();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const normalizedPhone = normalizePhone(phone);
    const passwordLength = [...password].length;
    if (!validPhone(normalizedPhone)) {
      setError("Enter an international phone number starting with +");
      return;
    }
    if (passwordLength < PASSWORD_MIN_LENGTH || passwordLength > PASSWORD_MAX_LENGTH) {
      setError(`Password must be ${PASSWORD_MIN_LENGTH}–${PASSWORD_MAX_LENGTH} characters`);
      return;
    }
    setError(null);
    try {
      await login.mutateAsync({ phone: normalizedPhone, password });
      navigate(safeCustomerNext(params.get("next")), { replace: true });
    } catch (reason) {
      setError(
        reason instanceof ApiError ? "Invalid phone number or password" : "Could not sign in",
      );
    }
  };

  return (
    <main className="grid min-h-dvh place-items-center bg-white px-6">
      <form
        onSubmit={submit}
        className="card-float w-full max-w-sm rounded-3xl bg-white p-6 ring-1 ring-slate-200"
      >
        <p className="text-4xl">🪈</p>
        <h1 className="font-display mt-2 text-2xl font-semibold text-stone-900">
          Customer sign in
        </h1>
        <p className="mt-1 text-xs text-slate-500">Use your phone number to access your account.</p>
        <label className="mt-4 block text-xs font-semibold text-slate-600">
          Phone number
          <Input
            name="phone"
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(normalizePhone(e.target.value))}
            placeholder="+91 98765 43210"
            autoComplete="tel"
            autoFocus
            required
            pattern={PHONE_PATTERN.source}
            className="mt-1 h-auto w-full rounded-xl bg-slate-50 px-4 py-3 text-center text-lg font-bold outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
          />
        </label>
        <label className="mt-2 block text-xs font-semibold text-slate-600">
          Password
          <Input
            name="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value.slice(0, PASSWORD_MAX_LENGTH))}
            placeholder="Password"
            autoComplete="current-password"
            required
            minLength={PASSWORD_MIN_LENGTH}
            className="mt-1 h-auto w-full rounded-xl bg-slate-50 px-4 py-3 text-center text-lg font-bold outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
          />
        </label>
        {error && <p className="mt-2 text-center text-xs font-semibold text-rose-600">{error}</p>}
        <Button
          type="submit"
          disabled={login.isPending || !phone.trim() || !password}
          className="mt-4 h-auto w-full rounded-xl bg-rose-600 px-4 py-3 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-50"
        >
          {login.isPending ? "…" : "Sign in"}
        </Button>
        <p className="mt-4 text-center text-xs text-slate-500">
          New here?{" "}
          <Link to="/signup" className="font-semibold text-rose-600 hover:underline">
            Create an account
          </Link>
        </p>
      </form>
    </main>
  );
}
