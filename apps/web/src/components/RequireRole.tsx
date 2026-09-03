import { Navigate, useLocation } from "react-router";
import type { ReactNode } from "react";
import { ApiError, useMe } from "@/api/hooks";
import { canAccess, type StaffRole } from "@/lib/roles";

// Client-side mirror of the old Next.js middleware: gate a route by role,
// redirecting to login (carrying `next` and, on a wrong-role denial, `denied`
// so the login screen can show why it bounced them back). The API still
// enforces the same rules server-side — this only decides what the SPA shows.
export default function RequireRole({
  roles,
  children,
}: {
  roles?: StaffRole[];
  children: ReactNode;
}) {
  const { data, isLoading, isError, error } = useMe();
  const location = useLocation();

  if (isLoading) return null;

  const unauthorized = isError && error instanceof ApiError && error.status === 401;
  const role = data?.role ?? null;

  if (unauthorized || !role) {
    return <Navigate to="/" replace />;
  }

  const allowed = roles ? roles.includes(role) : canAccess(location.pathname, role);
  if (!allowed) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
