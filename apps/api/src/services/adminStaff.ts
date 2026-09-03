import {
  firstNameSchema,
  lastNameSchema,
  passwordSchema,
  usernameSchema,
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
import { env } from "../env.js";

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

export async function ensureAdminBootstrap(repos: Pick<Repos, "staff" | "outlets">): Promise<void> {
  const configured = [
    env.ADMIN_BOOTSTRAP_USERNAME,
    env.ADMIN_BOOTSTRAP_FIRST_NAME,
    env.ADMIN_BOOTSTRAP_LAST_NAME,
    env.ADMIN_BOOTSTRAP_PASSWORD,
    env.ADMIN_BOOTSTRAP_OUTLET_SLUG,
  ];
  if (!configured.some(Boolean)) return;
  const usernameResult = usernameSchema.safeParse(env.ADMIN_BOOTSTRAP_USERNAME);
  const firstNameResult = firstNameSchema.safeParse(env.ADMIN_BOOTSTRAP_FIRST_NAME);
  const lastNameResult = env.ADMIN_BOOTSTRAP_LAST_NAME
    ? lastNameSchema.safeParse(env.ADMIN_BOOTSTRAP_LAST_NAME)
    : { success: true as const, data: undefined };
  const passwordResult = passwordSchema.safeParse(env.ADMIN_BOOTSTRAP_PASSWORD);
  if (
    !usernameResult.success ||
    !firstNameResult.success ||
    !lastNameResult.success ||
    !passwordResult.success
  ) {
    throw new Error("invalid admin bootstrap configuration");
  }
  const username = usernameResult.data;
  const firstName = firstNameResult.data;
  const outlets = await repos.outlets.listActive();
  const outlet = env.ADMIN_BOOTSTRAP_OUTLET_SLUG
    ? await repos.outlets.findActiveBySlug(env.ADMIN_BOOTSTRAP_OUTLET_SLUG)
    : outlets.length === 1
      ? outlets[0]
      : null;
  if (!outlet)
    throw new Error("bootstrap requires one active outlet or ADMIN_BOOTSTRAP_OUTLET_SLUG");
  const admins = await repos.staff.listByOutlet(outlet.id);
  if (
    admins.some(
      (staff) =>
        staff.active &&
        staff.role === "admin" &&
        usernameSchema.safeParse(staff.username).success &&
        firstNameSchema.safeParse(staff.first_name).success &&
        isStrictPasswordHash(staff.password_hash),
    )
  )
    return;
  const existing =
    (await repos.staff.findByUsername(outlet.id, username)) ??
    admins.find(
      (staff) => staff.active && staff.role === "admin" && (!staff.username || !staff.first_name),
    );
  const passwordHash = await hashPassword(passwordResult.data);
  if (existing) {
    if (existing.role !== "admin" && existing.active)
      throw conflict("bootstrap username belongs to another role");
    await repos.staff.update(existing.id, {
      username,
      first_name: firstName,
      last_name: lastNameResult.data?.trim() || null,
      role: "admin",
      password_hash: passwordHash,
      active: true,
    });
    return;
  }
  await repos.staff.create({
    outlet_id: outlet.id,
    username,
    first_name: firstName,
    last_name: lastNameResult.data?.trim() || null,
    role: "admin",
    password_hash: passwordHash,
    active: true,
  });
}
