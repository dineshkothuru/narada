import { z } from "zod";
import { firstNameSchema, lastNameSchema, passwordSchema, usernameSchema } from "./adminLogin.js";

export const staffRoleSchema = z.enum(["admin", "kitchen", "waiter", "reception", "cashier"]);
export const createStaffSchema = z.object({
  username: usernameSchema,
  firstName: firstNameSchema,
  lastName: lastNameSchema,
  role: staffRoleSchema,
  password: passwordSchema,
});
export type CreateStaffInput = z.infer<typeof createStaffSchema>;

export const patchStaffSchema = z
  .object({
    staffId: z.string().uuid("staffId required"),
    username: usernameSchema.optional(),
    firstName: firstNameSchema.optional(),
    lastName: lastNameSchema.nullable().optional(),
    role: staffRoleSchema.optional(),
    password: passwordSchema.optional(),
    active: z.boolean().optional(),
  })
  .refine(
    (value) => Object.keys(value).some((key) => key !== "staffId"),
    "at least one staff field required",
  );
export type PatchStaffInput = z.infer<typeof patchStaffSchema>;

export const deleteStaffQuerySchema = z
  .object({ staffId: z.string().uuid().optional(), id: z.string().uuid().optional() })
  .refine((value) => Boolean(value.staffId ?? value.id), "staffId required");
export type DeleteStaffQuery = z.infer<typeof deleteStaffQuerySchema>;

export type StaffRow = {
  id: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  displayName: string;
  role: string;
  active: boolean;
  created_at: string;
  needsSetup: boolean;
};
export type StaffListResponse = { staff: StaffRow[] };
export type CreateStaffResponse = { ok: true; staff: StaffRow };
export type PatchStaffResponse = { ok: true; staff: StaffRow };
export type DeleteStaffResponse = { ok: true };
