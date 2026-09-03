import { z } from "zod";

// POST /api/admin/staff
export const createStaffSchema = z.object({
  name: z.string().min(1, "name, role and a PIN of 4+ characters required"),
  role: z.string().min(1, "name, role and a PIN of 4+ characters required"),
  pin: z.string().min(4, "name, role and a PIN of 4+ characters required"),
});
export type CreateStaffInput = z.infer<typeof createStaffSchema>;

// PATCH /api/admin/staff
export const patchStaffSchema = z.object({
  staffId: z.string().min(1, "staffId and active required"),
  active: z.boolean(),
});
export type PatchStaffInput = z.infer<typeof patchStaffSchema>;

// DELETE /api/admin/staff?id=<id>
export const deleteStaffQuerySchema = z.object({
  id: z.string().min(1, "id required"),
});
export type DeleteStaffQuery = z.infer<typeof deleteStaffQuerySchema>;

export type StaffRow = {
  id: string;
  name: string;
  role: string;
  pin: string;
  active: boolean;
  created_at: string;
};

export type StaffListResponse = { staff: StaffRow[] };
export type CreateStaffResponse = { ok: true };
export type PatchStaffResponse = { ok: true };
export type DeleteStaffResponse = { ok: true };
