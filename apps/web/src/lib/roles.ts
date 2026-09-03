// Mirrors web/lib/admin-auth.ts ROLE_ACCESS — page paths only (data, no fetch
// logic). The API's own role checks are the source of truth; this only
// decides what the SPA shows/hides and where RequireRole sends people.
export const STAFF_ROLES = ["admin", "kitchen", "waiter", "reception", "cashier"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const isStaffRole = (v: unknown): v is StaffRole =>
  typeof v === "string" && (STAFF_ROLES as readonly string[]).includes(v);

export const ROLE_ACCESS: Record<string, StaffRole[]> = {
  "/admin": ["admin"],
  "/kitchen": ["admin", "kitchen"],
  "/waiter": ["admin", "waiter"],
  "/floor": ["admin", "waiter", "reception", "cashier"],
  "/counter": ["admin", "cashier"],
};

// Longest matching prefix wins, matching is segment-aware so "/admin" never
// claims "/administrator".
export function rolesForPath(pathname: string): StaffRole[] | null {
  let best: { prefix: string; roles: StaffRole[] } | null = null;
  for (const [prefix, roles] of Object.entries(ROLE_ACCESS)) {
    const matches = pathname === prefix || pathname.startsWith(`${prefix}/`);
    if (matches && (!best || prefix.length > best.prefix.length)) {
      best = { prefix, roles };
    }
  }
  return best ? best.roles : null;
}

export function canAccess(pathname: string, role: StaffRole | null): boolean {
  if (role === null) return false;
  const roles = rolesForPath(pathname);
  return roles === null || roles.includes(role);
}

export const ROLE_LABEL: Record<StaffRole, string> = {
  admin: "Owner",
  kitchen: "Kitchen",
  waiter: "Waiter",
  reception: "Reception",
  cashier: "Counter",
};

// Where a role lands after login, absent a `next` param.
export const ROLE_HOME: Record<StaffRole, string> = {
  admin: "/admin",
  kitchen: "/kitchen",
  waiter: "/waiter",
  reception: "/floor",
  cashier: "/floor",
};
