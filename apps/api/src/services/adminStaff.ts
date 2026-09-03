import type { Repos } from "../repositories/index.js";
import { badRequest, conflict, notFound } from "../lib/http.js";
import { isStaffRole } from "../plugins/auth.js";
import type { CreateStaffInput, PatchStaffInput, StaffListResponse } from "@narada/shared";

// Port of web/app/api/admin/staff/route.ts.
export async function listStaff(repos: Pick<Repos, "staff">): Promise<StaffListResponse> {
  const staff = await repos.staff.listAll();
  return {
    staff: staff.map((s) => ({
      id: s.id,
      name: s.name,
      role: s.role,
      pin: s.pin,
      active: s.active,
      created_at: s.created_at,
    })),
  };
}

export async function createStaff(
  repos: Pick<Repos, "staff" | "outlets">,
  input: CreateStaffInput,
): Promise<{ ok: true }> {
  const name = input.name.trim();
  if (!name || !isStaffRole(input.role) || !input.pin || input.pin.length < 4) {
    throw badRequest("name, role and a PIN of 4+ characters required");
  }

  const outlet = await repos.outlets.findFirst();
  if (!outlet) throw notFound("no outlet");
  if (outlet.admin_pin === input.pin) {
    throw conflict("PIN already used by the owner");
  }

  try {
    await repos.staff.create({
      outlet_id: outlet.id,
      name: name.slice(0, 60),
      role: input.role,
      pin: input.pin.slice(0, 20),
    });
  } catch {
    throw conflict("PIN already in use");
  }
  return { ok: true };
}

export async function patchStaff(
  repos: Pick<Repos, "staff">,
  input: PatchStaffInput,
): Promise<{ ok: true }> {
  if (!input.staffId || typeof input.active !== "boolean") {
    throw badRequest("staffId and active required");
  }
  await repos.staff.setActive(input.staffId, input.active);
  return { ok: true };
}

export async function deleteStaff(repos: Pick<Repos, "staff">, id: string): Promise<{ ok: true }> {
  if (!id) throw badRequest("id required");
  await repos.staff.remove(id);
  return { ok: true };
}
