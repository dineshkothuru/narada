import { STAFF_COOKIE, staffToken, type StaffRole } from "../../src/plugins/auth.js";
import type { FakeDb } from "./fakeRepos.js";

export function staffCookie(data: FakeDb, role: StaffRole, outletId?: string) {
  const targetOutletId = outletId ?? String(data.outlets[0]?.id ?? "");
  const staff = data.staff.find(
    (row) => row.outlet_id === targetOutletId && row.role === role && row.active === true,
  );
  if (!staff) throw new Error(`no active ${role} staff for outlet ${targetOutletId}`);
  return { [STAFF_COOKIE]: staffToken(String(staff.id), targetOutletId, role) };
}

export function staffHeader(data: FakeDb, role: StaffRole, outletId?: string) {
  const cookie = staffCookie(data, role, outletId)[STAFF_COOKIE];
  return `${STAFF_COOKIE}=${cookie}`;
}
