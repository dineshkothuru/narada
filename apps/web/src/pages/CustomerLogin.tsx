import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@narada/shared";
import { ApiError, useCustomerLogin } from "@/api/hooks";
import { Button } from "@/components/ui/button";
import CustomerPhoneField from "@/components/CustomerPhoneField";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { composePhone, DEFAULT_COUNTRY_CODE, validPhone } from "@/lib/phone";
import { safeCustomerNext } from "@/lib/customerAuth";

export default function CustomerLoginPage() {
  const login = useCustomerLogin();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [countryCode, setCountryCode] = useState(DEFAULT_COUNTRY_CODE);
  const [nationalNumber, setNationalNumber] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [invalidField, setInvalidField] = useState<"phone" | "password" | null>(null);
  const errorId = "customer-login-error";

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const normalizedPhone = composePhone(countryCode, nationalNumber);
    const passwordLength = [...password].length;
    if (!validPhone(normalizedPhone)) {
      setError("Enter a valid phone number");
      setInvalidField("phone");
      return;
    }
    if (passwordLength < PASSWORD_MIN_LENGTH || passwordLength > PASSWORD_MAX_LENGTH) {
      setError(`Password must be ${PASSWORD_MIN_LENGTH}–${PASSWORD_MAX_LENGTH} characters`);
      setInvalidField("password");
      return;
    }
    setError(null);
    setInvalidField(null);
    try {
      await login.mutateAsync({ phone: normalizedPhone, password });
      navigate(safeCustomerNext(params.get("next")), { replace: true });
    } catch (reason) {
      setInvalidField(null);
      setError(
        reason instanceof ApiError ? "Invalid phone number or password" : "Could not sign in",
      );
    }
  };

  return (
    <main className="grid min-h-dvh place-items-center bg-white px-6">
      <form noValidate onSubmit={submit} className="w-full max-w-sm">
        <Card className="card-float rounded-3xl p-0">
          <CardHeader className="p-6 pb-0">
            <p className="text-4xl">🪈</p>
            <CardTitle className="mt-2">
              <h1 className="font-display text-2xl font-semibold text-foreground">
                Customer sign in
              </h1>
            </CardTitle>
            <CardDescription className="text-xs">
              Use your phone number to access your account.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 pt-4">
            <FieldGroup className="gap-3">
              <CustomerPhoneField
                countryCode={countryCode}
                nationalNumber={nationalNumber}
                onCountryCodeChange={setCountryCode}
                onNationalNumberChange={setNationalNumber}
                invalid={invalidField === "phone"}
                describedBy={error ? errorId : undefined}
              />
              <Field data-invalid={invalidField === "password" || undefined} className="gap-1.5">
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value.slice(0, PASSWORD_MAX_LENGTH))}
                  placeholder="Password"
                  autoComplete="current-password"
                  required
                  minLength={PASSWORD_MIN_LENGTH}
                  aria-invalid={invalidField === "password" || undefined}
                  aria-describedby={error ? errorId : undefined}
                  className="h-11 rounded-xl bg-muted/40 px-4 text-center text-lg font-bold"
                />
              </Field>
              <FieldError id={errorId}>{error}</FieldError>
            </FieldGroup>
          </CardContent>
          <CardFooter className="flex-col border-0 bg-transparent p-6 pt-0">
            <Button
              type="submit"
              disabled={login.isPending || !nationalNumber.trim() || !password}
              aria-busy={login.isPending}
              className="h-11 w-full rounded-xl px-4"
            >
              {login.isPending && <Spinner data-icon="inline-start" />}
              {login.isPending ? "Signing in…" : "Sign in"}
            </Button>
            <p className="mt-4 text-center text-xs text-muted-foreground">
              New here?{" "}
              <Link to="/signup" className="font-semibold text-primary hover:underline">
                Create an account
              </Link>
            </p>
          </CardFooter>
        </Card>
      </form>
    </main>
  );
}
