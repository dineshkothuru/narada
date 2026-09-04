import { useState } from "react";
import { Navigate, useParams, useSearchParams } from "react-router";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@narada/shared";
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
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
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
  const [invalidField, setInvalidField] = useState<"username" | "password" | "form" | null>(null);
  const passwordLength = [...password].length;

  if (!slug) return <Navigate to="/" replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const canonicalUsername = normalizeUsername(username.trim());
    if (!validUsername(canonicalUsername)) {
      setInvalidField("username");
      setError(
        `Username must be ${USERNAME_MIN_LENGTH}–${USERNAME_MAX_LENGTH} lowercase letters, numbers, ., _, or -`,
      );
      return;
    }
    if (passwordLength < PASSWORD_MIN_LENGTH || passwordLength > PASSWORD_MAX_LENGTH) {
      setInvalidField("password");
      setError(`Password must be ${PASSWORD_MIN_LENGTH}–${PASSWORD_MAX_LENGTH} characters`);
      return;
    }
    setError(null);
    setInvalidField(null);
    try {
      const d = await scopedLogin.mutateAsync({ username: canonicalUsername, password });
      const next = safeNext(params.get("next"), d.role) ?? ROLE_HOME[d.role];
      window.location.replace(next);
    } catch (e) {
      setInvalidField("form");
      setError(e instanceof ApiError ? "Invalid username or password" : "Could not sign in");
    }
  };

  return (
    <main className="console grid min-h-dvh place-items-center px-6">
      <Card className="panel panel-lift w-full max-w-sm gap-0 p-6">
        <form onSubmit={submit} noValidate className="flex flex-col">
          <CardHeader className="p-0">
            <p className="text-4xl">🪈</p>
            <CardTitle className="mt-2">
              <h1 className="font-display text-2xl font-semibold text-foreground">Staff login</h1>
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Use your staff account to continue.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 pt-4">
            <FieldGroup className="gap-2">
              <Field data-invalid={invalidField === "username"}>
                <FieldLabel htmlFor="staff-username">Username</FieldLabel>
                <Input
                  id="staff-username"
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
                  className="h-11 rounded-xl bg-muted/40 px-4 text-center text-lg font-bold focus-visible:ring-2 focus-visible:ring-ring"
                  aria-invalid={invalidField === "username"}
                  aria-describedby={
                    invalidField === "username"
                      ? "staff-username-description staff-username-error"
                      : "staff-username-description"
                  }
                />
                <FieldDescription id="staff-username-description">
                  Lowercase letters, numbers, ., _, or -
                </FieldDescription>
                {invalidField === "username" && (
                  <FieldError id="staff-username-error">{error}</FieldError>
                )}
              </Field>
              <Field data-invalid={invalidField === "password"}>
                <FieldLabel htmlFor="staff-password">Password</FieldLabel>
                <Input
                  id="staff-password"
                  name="password"
                  type="password"
                  value={password}
                  onChange={(e) => {
                    if ([...e.target.value].length <= PASSWORD_MAX_LENGTH)
                      setPassword(e.target.value);
                  }}
                  placeholder="Password"
                  autoComplete="current-password"
                  required
                  minLength={PASSWORD_MIN_LENGTH}
                  className="h-11 rounded-xl bg-muted/40 px-4 text-center text-lg font-bold focus-visible:ring-2 focus-visible:ring-ring"
                  aria-invalid={invalidField === "password"}
                  aria-describedby={
                    invalidField === "password"
                      ? "staff-password-description staff-password-error"
                      : "staff-password-description"
                  }
                />
                <FieldDescription id="staff-password-description">
                  {PASSWORD_MIN_LENGTH}–{PASSWORD_MAX_LENGTH} characters
                </FieldDescription>
                {invalidField === "password" && (
                  <FieldError id="staff-password-error">{error}</FieldError>
                )}
              </Field>
              {invalidField === "form" && <FieldError id="staff-login-error">{error}</FieldError>}
            </FieldGroup>
          </CardContent>
          <CardFooter className="mt-4 p-0">
            <Button
              type="submit"
              disabled={
                scopedLogin.isPending || !username.trim() || passwordLength < PASSWORD_MIN_LENGTH
              }
              aria-busy={scopedLogin.isPending}
              className="h-11 w-full rounded-xl"
            >
              {scopedLogin.isPending && <Spinner data-icon="inline-start" />}
              {scopedLogin.isPending ? "Signing in…" : "Sign in"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </main>
  );
}
