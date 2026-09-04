import {
  createStaffSchema,
  patchStaffSchema,
  type CreateStaffInput,
  type PatchStaffInput,
  type StaffListResponse,
  type StaffRow,
} from "@narada/shared";
import type { Repos } from "../repositories/index.js";
import { badRequest, conflict, notFound } from "../lib/http.js";
import { isStaffRole, type StaffSession } from "../plugins/auth.js";
import { hashPassword, isStrictPasswordHash } from "../lib/password.js";

type StaffRepo = Repos["staff"];
type StaffRecord = Awaited<ReturnType<StaffRepo["findById"]>>;

const rowView = (row: NonNullable<StaffRecord>): StaffRow => ({
  id: row.id,
  username: row.username,
  firstName: row.first_name,
  lastName: row.last_name,
  displayName: [row.first_name, row.last_name].filter(Boolean).join(" "),
  role: row.role,
  active: row.active,
  created_at: row.created_at,
  needsSetup: !row.username || !row.first_name || !isStrictPasswordHash(row.password_hash),
});

const outletFor = async (repos: Pick<Repos, "outlets">, session: StaffSession) => {
  const outlet = await repos.outlets.findActiveById(session.outletId);
  if (!outlet) throw notFound("no active outlet");
  return outlet;
};

export async function listStaff(
  repos: Pick<Repos, "staff" | "outlets">,
  session: StaffSession,
): Promise<StaffListResponse> {
  const outlet = await outletFor(repos, session);
  const staff = await repos.staff.listByOutlet(outlet.id);
  return { staff: staff.map(rowView) };
}

export async function createStaff(
  repos: Pick<Repos, "staff" | "outlets">,
  input: CreateStaffInput,
  session: StaffSession,
): Promise<{ ok: true; staff: StaffRow }> {
  const outlet = await outletFor(repos, session);
  const parsed = createStaffSchema.safeParse(input);
  if (!parsed.success || !isStaffRole(parsed.data.role)) throw badRequest("invalid staff fields");
  const data = parsed.data;
  const passwordHash = await hashPassword(data.password);
  try {
    const created = await repos.staff.create({
      outlet_id: outlet.id,
      username: data.username,
      first_name: data.firstName,
      last_name: data.lastName || null,
      role: data.role,
      password_hash: passwordHash,
      active: true,
    });
    return { ok: true, staff: rowView(created) };
  } catch {
    throw conflict("username already in use");
  }
}

export async function patchStaff(
  repos: Pick<Repos, "staff" | "outlets">,
  input: PatchStaffInput,
  session: StaffSession,
): Promise<{ ok: true; staff: StaffRow }> {
  const outlet = await outletFor(repos, session);
  const parsed = patchStaffSchema.safeParse(input);
  if (!parsed.success) throw badRequest("invalid staff fields");
  const data = parsed.data;
  const target = await repos.staff.findById(data.staffId);
  if (!target || target.outlet_id !== outlet.id) throw notFound("staff not found");
  if (target.id === session.staffId && data.active === false)
    throw conflict("cannot deactivate yourself");
  const patch: Record<string, unknown> = {};
  if (data.username !== undefined) patch.username = data.username;
  if (data.firstName !== undefined) patch.first_name = data.firstName;
  if (data.lastName !== undefined) patch.last_name = data.lastName || null;
  if (data.role !== undefined) patch.role = data.role;
  if (data.active !== undefined) patch.active = data.active;
  if (data.password !== undefined) patch.password_hash = await hashPassword(data.password);
  let updated: Awaited<ReturnType<Repos["staff"]["updateScoped"]>>;
  try {
    updated = await repos.staff.updateScoped(data.staffId, outlet.id, patch);
  } catch (error) {
    if (error instanceof Error && error.message.includes("final active admin"))
      throw conflict("cannot remove the final active admin");
    throw conflict("username already in use");
  }
  if (!updated) throw notFound("staff not found");
  return { ok: true, staff: rowView(updated) };
}

export async function deleteStaff(
  repos: Pick<Repos, "staff" | "outlets">,
  id: string,
  session: StaffSession,
): Promise<{ ok: true }> {
  if (!id) throw badRequest("staffId required");
  const outlet = await outletFor(repos, session);
  const target = await repos.staff.findById(id);
  if (!target || target.outlet_id !== outlet.id) throw notFound("staff not found");
  if (target.id === session.staffId) throw conflict("cannot delete yourself");
  try {
    if (!(await repos.staff.removeScoped(id, outlet.id))) throw notFound("staff not found");
  } catch (error) {
    if (error instanceof Error && error.message.includes("final active admin"))
      throw conflict("cannot remove the final active admin");
    throw error;
  }
  return { ok: true };
}
