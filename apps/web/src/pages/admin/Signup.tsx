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
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";

export default function StaffSignupPage({ role }: { role: StaffRole }) {
  const addStaff = useAddStaff();
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState(false);
  const [invalidField, setInvalidField] = useState<
    "username" | "firstName" | "lastName" | "password" | "form" | null
  >(null);

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
    setInvalidField(null);
    if (!validUsername(username)) {
      setInvalidField("username");
      setError(
        `Username must be ${USERNAME_MIN_LENGTH}–${USERNAME_MAX_LENGTH} lowercase letters, numbers, ., _, or -`,
      );
      return;
    }
    if (!firstName || codePointLength(firstName) > 60) {
      setInvalidField("firstName");
      setError("First name is required (up to 60 characters); last name is optional (up to 60)");
      return;
    }
    if (codePointLength(lastName) > 60) {
      setInvalidField("lastName");
      setError("First name is required (up to 60 characters); last name is optional (up to 60)");
      return;
    }
    const passwordLength = [...password].length;
    if (passwordLength < PASSWORD_MIN_LENGTH || passwordLength > PASSWORD_MAX_LENGTH) {
      setInvalidField("password");
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
      setInvalidField("form");
      setError(e instanceof ApiError ? e.message : "Could not create account");
    }
  };

  return (
    <main className="console grid min-h-dvh place-items-center px-6">
      <Card className="panel panel-lift w-full max-w-sm gap-0 p-6">
        <form onSubmit={submit} noValidate className="flex flex-col">
          <CardHeader className="p-0">
            <p className="text-4xl">🪈</p>
            <CardTitle className="mt-2">
              <h1 className="font-display text-2xl font-semibold text-foreground">
                Add {ROLE_LABEL[role]} account
              </h1>
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              An admin-authorized staff account.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 pt-4">
            <FieldGroup className="gap-2">
              <Field data-invalid={invalidField === "username"}>
                <FieldLabel htmlFor="staff-signup-username">Username</FieldLabel>
                <Input
                  id="staff-signup-username"
                  name="username"
                  required
                  minLength={USERNAME_MIN_LENGTH}
                  maxLength={USERNAME_MAX_LENGTH}
                  pattern={USERNAME_PATTERN.source}
                  placeholder="username"
                  autoComplete="username"
                  aria-invalid={invalidField === "username"}
                  aria-describedby={
                    invalidField === "username"
                      ? "staff-signup-username-description staff-signup-username-error"
                      : "staff-signup-username-description"
                  }
                  onChange={(e) => {
                    e.currentTarget.value = normalizeUsername(e.currentTarget.value);
                  }}
                />
                <FieldDescription id="staff-signup-username-description">
                  Lowercase letters, numbers, ., _, or -
                </FieldDescription>
                {invalidField === "username" && (
                  <FieldError id="staff-signup-username-error">{error}</FieldError>
                )}
              </Field>
              <Field data-invalid={invalidField === "firstName"}>
                <FieldLabel htmlFor="staff-first-name">First name</FieldLabel>
                <Input
                  id="staff-first-name"
                  name="firstName"
                  required
                  placeholder="First name"
                  autoComplete="given-name"
                  aria-invalid={invalidField === "firstName"}
                  aria-describedby={
                    invalidField === "firstName"
                      ? "staff-first-name-description staff-first-name-error"
                      : "staff-first-name-description"
                  }
                  onChange={(e) => {
                    e.currentTarget.value = limitCodePoints(e.currentTarget.value, 60);
                  }}
                />
                <FieldDescription id="staff-first-name-description">
                  Up to 60 characters
                </FieldDescription>
                {invalidField === "firstName" && (
                  <FieldError id="staff-first-name-error">{error}</FieldError>
                )}
              </Field>
              <Field data-invalid={invalidField === "lastName"}>
                <FieldLabel htmlFor="staff-last-name">
                  Last name <span className="font-normal text-muted-foreground">(optional)</span>
                </FieldLabel>
                <Input
                  id="staff-last-name"
                  name="lastName"
                  placeholder="Last name"
                  autoComplete="family-name"
                  aria-invalid={invalidField === "lastName"}
                  aria-describedby={
                    invalidField === "lastName"
                      ? "staff-last-name-description staff-last-name-error"
                      : "staff-last-name-description"
                  }
                  onChange={(e) => {
                    e.currentTarget.value = limitCodePoints(e.currentTarget.value, 60);
                  }}
                />
                <FieldDescription id="staff-last-name-description">
                  Optional, up to 60 characters
                </FieldDescription>
                {invalidField === "lastName" && (
                  <FieldError id="staff-last-name-error">{error}</FieldError>
                )}
              </Field>
              <Field data-invalid={invalidField === "password"}>
                <FieldLabel htmlFor="staff-signup-password">Password</FieldLabel>
                <Input
                  id="staff-signup-password"
                  name="password"
                  type="password"
                  required
                  minLength={PASSWORD_MIN_LENGTH}
                  autoComplete="new-password"
                  placeholder="Password (15–128 characters)"
                  aria-invalid={invalidField === "password"}
                  aria-describedby={
                    invalidField === "password"
                      ? "staff-signup-password-description staff-signup-password-error"
                      : "staff-signup-password-description"
                  }
                  onChange={(e) => {
                    if ([...e.currentTarget.value].length > PASSWORD_MAX_LENGTH) {
                      e.currentTarget.value = [...e.currentTarget.value]
                        .slice(0, PASSWORD_MAX_LENGTH)
                        .join("");
                    }
                  }}
                />
                <FieldDescription id="staff-signup-password-description">
                  {PASSWORD_MIN_LENGTH}–{PASSWORD_MAX_LENGTH} characters
                </FieldDescription>
                {invalidField === "password" && (
                  <FieldError id="staff-signup-password-error">{error}</FieldError>
                )}
              </Field>
              {invalidField === "form" && <FieldError id="staff-signup-error">{error}</FieldError>}
              {created && (
                <Alert variant="success">
                  <AlertDescription>
                    Account created. <Link to="/">Return home to sign in</Link>
                  </AlertDescription>
                </Alert>
              )}
            </FieldGroup>
          </CardContent>
          <CardFooter className="mt-4 p-0">
            <Button
              type="submit"
              disabled={addStaff.isPending}
              aria-busy={addStaff.isPending}
              className="h-11 w-full rounded-xl"
            >
              {addStaff.isPending && <Spinner data-icon="inline-start" />}
              {addStaff.isPending ? "Creating account…" : "Create account"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </main>
  );
}
