import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@narada/shared";
import { ApiError, useCustomerSignup } from "@/api/hooks";
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

const NAME_MAX_LENGTH = 60;

export default function CustomerSignupPage() {
  const signup = useCustomerSignup();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [countryCode, setCountryCode] = useState(DEFAULT_COUNTRY_CODE);
  const [nationalNumber, setNationalNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [invalidField, setInvalidField] = useState<
    "phone" | "firstName" | "lastName" | "password" | null
  >(null);
  const errorId = "customer-signup-error";

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fields = new FormData(e.currentTarget);
    const phone = composePhone(countryCode, nationalNumber);
    const firstName = String(fields.get("firstName") ?? "").trim();
    const lastName = String(fields.get("lastName") ?? "").trim();
    const password = String(fields.get("password") ?? "");
    const passwordLength = [...password].length;
    if (!validPhone(phone)) {
      setError("Enter a valid phone number");
      setInvalidField("phone");
      return;
    }
    if (!firstName || [...firstName].length > NAME_MAX_LENGTH) {
      setError("First name is required; last name is optional (up to 60 characters)");
      setInvalidField("firstName");
      return;
    }
    if ([...lastName].length > NAME_MAX_LENGTH) {
      setError("First name is required; last name is optional (up to 60 characters)");
      setInvalidField("lastName");
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
      await signup.mutateAsync({ phone, firstName, lastName: lastName || undefined, password });
      navigate(safeCustomerNext(params.get("next")), { replace: true });
    } catch (reason) {
      setInvalidField(null);
      setError(reason instanceof ApiError ? reason.message : "Could not create account");
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
                Create your account
              </h1>
            </CardTitle>
            <CardDescription className="text-xs">
              Save your details for your next Narada order.
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
              <Field data-invalid={invalidField === "firstName" || undefined} className="gap-1.5">
                <FieldLabel htmlFor="firstName">First name</FieldLabel>
                <Input
                  id="firstName"
                  name="firstName"
                  required
                  maxLength={NAME_MAX_LENGTH}
                  placeholder="First name"
                  autoComplete="given-name"
                  aria-invalid={invalidField === "firstName" || undefined}
                  aria-describedby={error ? errorId : undefined}
                  className="h-11 rounded-xl bg-muted/40"
                />
              </Field>
              <Field data-invalid={invalidField === "lastName" || undefined} className="gap-1.5">
                <FieldLabel htmlFor="lastName">
                  Last name <span className="font-normal text-muted-foreground">(optional)</span>
                </FieldLabel>
                <Input
                  id="lastName"
                  name="lastName"
                  maxLength={NAME_MAX_LENGTH}
                  placeholder="Last name"
                  autoComplete="family-name"
                  aria-invalid={invalidField === "lastName" || undefined}
                  aria-describedby={error ? errorId : undefined}
                  className="h-11 rounded-xl bg-muted/40"
                />
              </Field>
              <Field data-invalid={invalidField === "password" || undefined} className="gap-1.5">
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  minLength={PASSWORD_MIN_LENGTH}
                  maxLength={PASSWORD_MAX_LENGTH}
                  autoComplete="new-password"
                  placeholder="Password (15–128 characters)"
                  aria-invalid={invalidField === "password" || undefined}
                  aria-describedby={error ? errorId : undefined}
                  className="h-11 rounded-xl bg-muted/40"
                />
              </Field>
              <FieldError id={errorId}>{error}</FieldError>
            </FieldGroup>
          </CardContent>
          <CardFooter className="flex-col border-0 bg-transparent p-6 pt-0">
            <Button
              type="submit"
              disabled={signup.isPending}
              aria-busy={signup.isPending}
              className="h-11 w-full rounded-xl px-4"
            >
              {signup.isPending && <Spinner data-icon="inline-start" />}
              {signup.isPending ? "Creating account…" : "Create account"}
            </Button>
            <p className="mt-4 text-center text-xs text-muted-foreground">
              Already have an account?{" "}
              <Link to="/login" className="font-semibold text-primary hover:underline">
                Sign in
              </Link>
            </p>
          </CardFooter>
        </Card>
      </form>
    </main>
  );
}
