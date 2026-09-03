import { timingSafeEqual } from "node:crypto";
import { type StaffRole, isStaffRole } from "../plugins/auth.js";
import type { Repos } from "../repositories/index.js";
import { badRequest } from "../lib/http.js";

// Port of web/app/api/admin/login/route.ts. PIN -> role lookup across staff
// and the outlet's admin_pin, compared in-process (constant time) instead of
// filtering by pin in the query, which would leak timing and log the secret.
function pinsMatch(a: string, b: string): boolean {
  const ba = Buffer.from(a.padEnd(64, "\0"));
  const bb = Buffer.from(b.padEnd(64, "\0"));
  return a.length === b.length && timingSafeEqual(ba, bb);
}

export type LoginResult = { role: StaffRole; name: string };

export async function login(
  repos: Pick<Repos, "staff" | "outlets">,
  pin: string,
): Promise<LoginResult | null> {
  if (!pin) throw badRequest("pin required");

  const [staff, outlet] = await Promise.all([
    repos.staff.listActiveWithPins(),
    repos.outlets.findFirst(),
  ]);

  const match = staff.find((s) => isStaffRole(s.role) && pinsMatch(String(s.pin), pin));
  if (match) return { role: match.role as StaffRole, name: match.name };

  if (outlet && pinsMatch(String(outlet.admin_pin), pin)) {
    return { role: "admin", name: "Owner" };
  }

  return null;
}
