import { passwordSchema, type OutletIdentity, type StaffIdentity } from "@narada/shared";
import { type StaffRole, isStaffRole, staffToken } from "../plugins/auth.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import type { Repos } from "../repositories/index.js";
import { HttpError } from "../lib/http.js";

const DUMMY_PASSWORD_HASH =
  "scrypt$v=1$N=16384,r=8,p=5$aZd_uRPcpqGPxiRMOk2CCw$3ktJ2aAOVXnO3u4R-zEKxbQpvpH23VnBnrsfUHhDUdE";

export type LoginResult = {
  role: StaffRole;
  token: string;
  staff: StaffIdentity;
  outlet: OutletIdentity;
};

const identity = (row: {
  id: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  role: string;
}): StaffIdentity | null => {
  if (!row.username || !row.first_name || !isStaffRole(row.role)) return null;
  return {
    id: row.id,
    username: row.username,
    firstName: row.first_name,
    lastName: row.last_name,
    displayName: [row.first_name, row.last_name].filter(Boolean).join(" "),
    role: row.role,
  };
};

export async function login(
  repos: Pick<Repos, "staff" | "outlets">,
  outletId: string,
  username: string,
  password: string,
): Promise<LoginResult | null> {
  const validPassword = passwordSchema.safeParse(password).success;
  const outlet = await repos.outlets.findActiveById(outletId);
  const normalized = username.trim().toLowerCase();
  const account = outlet ? await repos.staff.findActiveByUsername(outlet.id, normalized) : null;
  const passwordOk = await verifyPassword(account?.password_hash ?? DUMMY_PASSWORD_HASH, password);
  const staff = account && passwordOk ? identity(account) : null;
  if (!validPassword || !outlet || !staff) return null;
  return {
    role: staff.role as StaffRole,
    token: staffToken(staff.id, outlet.id, staff.role as StaffRole),
    staff,
    outlet: { id: outlet.id, name: outlet.name, slug: outlet.slug },
  };
}

export async function changePassword(
  repos: Pick<Repos, "staff">,
  session: { staffId: string },
  currentPassword: string,
  newPassword: string,
): Promise<{ ok: true }> {
  const row = await repos.staff.findById(session.staffId);
  const currentOk = await verifyPassword(
    row?.password_hash ?? DUMMY_PASSWORD_HASH,
    currentPassword,
  );
  if (!row || !currentOk || !passwordSchema.safeParse(newPassword).success) {
    throw new HttpError(401, "invalid credentials");
  }
  await repos.staff.update(row.id, { password_hash: await hashPassword(newPassword) });
  return { ok: true };
}
