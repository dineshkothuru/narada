import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@narada/shared";
import { ApiError, useCustomerSignup } from "@/api/hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { normalizePhone, PHONE_PATTERN, validPhone } from "@/lib/phone";
import { safeCustomerNext } from "@/lib/customerAuth";

const NAME_MAX_LENGTH = 60;

export default function CustomerSignupPage() {
  const signup = useCustomerSignup();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fields = new FormData(e.currentTarget);
    const phone = normalizePhone(String(fields.get("phone") ?? ""));
    const firstName = String(fields.get("firstName") ?? "").trim();
    const lastName = String(fields.get("lastName") ?? "").trim();
    const password = String(fields.get("password") ?? "");
    const passwordLength = [...password].length;
    if (!validPhone(phone)) {
      setError("Enter an international phone number starting with +");
      return;
    }
    if (
      !firstName ||
      [...firstName].length > NAME_MAX_LENGTH ||
      [...lastName].length > NAME_MAX_LENGTH
    ) {
      setError("First name is required; last name is optional (up to 60 characters)");
      return;
    }
    if (passwordLength < PASSWORD_MIN_LENGTH || passwordLength > PASSWORD_MAX_LENGTH) {
      setError(`Password must be ${PASSWORD_MIN_LENGTH}–${PASSWORD_MAX_LENGTH} characters`);
      return;
    }
    setError(null);
    try {
      await signup.mutateAsync({ phone, firstName, lastName: lastName || undefined, password });
      navigate(safeCustomerNext(params.get("next")), { replace: true });
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Could not create account");
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
          Create your account
        </h1>
        <p className="mt-1 text-xs text-slate-500">Save your details for your next Narada order.</p>
        <label className="mt-4 block text-xs font-semibold text-slate-600">
          Phone number
          <Input
            name="phone"
            type="tel"
            inputMode="tel"
            placeholder="+91 98765 43210"
            autoComplete="tel"
            autoFocus
            required
            pattern={PHONE_PATTERN.source}
            onChange={(e) => {
              e.currentTarget.value = normalizePhone(e.currentTarget.value);
            }}
            className="mt-1"
          />
        </label>
        <label className="mt-2 block text-xs font-semibold text-slate-600">
          First name
          <Input
            name="firstName"
            required
            maxLength={NAME_MAX_LENGTH}
            placeholder="First name"
            autoComplete="given-name"
            className="mt-1"
          />
        </label>
        <label className="mt-2 block text-xs font-semibold text-slate-600">
          Last name <span className="font-normal text-slate-400">(optional)</span>
          <Input
            name="lastName"
            maxLength={NAME_MAX_LENGTH}
            placeholder="Last name"
            autoComplete="family-name"
            className="mt-1"
          />
        </label>
        <label className="mt-2 block text-xs font-semibold text-slate-600">
          Password
          <Input
            name="password"
            type="password"
            required
            minLength={PASSWORD_MIN_LENGTH}
            maxLength={PASSWORD_MAX_LENGTH}
            autoComplete="new-password"
            placeholder="Password (15–128 characters)"
            className="mt-1"
          />
        </label>
        {error && <p className="mt-2 text-center text-xs font-semibold text-rose-600">{error}</p>}
        <Button
          type="submit"
          disabled={signup.isPending}
          className="mt-4 h-auto w-full rounded-xl bg-rose-600 px-4 py-3 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-50"
        >
          {signup.isPending ? "…" : "Create account"}
        </Button>
        <p className="mt-4 text-center text-xs text-slate-500">
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-rose-600 hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </main>
  );
}
