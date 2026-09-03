import { z } from "zod";

export const PASSWORD_MIN_LENGTH = 15;
export const PASSWORD_MAX_LENGTH = 128;

const codePointString = (min: number, max: number, message: string) =>
  z.string().superRefine((value, ctx) => {
    const length = [...value].length;
    if (length < min || length > max) ctx.addIssue({ code: "custom", message });
  });

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._-]{3,32}$/, "username must be 3-32 lowercase ASCII characters");
export const firstNameSchema = z
  .string()
  .transform((value) => value.trim())
  .pipe(codePointString(1, 60, "firstName must be 1-60 characters"));
export const lastNameSchema = z
  .string()
  .transform((value) => value.trim())
  .pipe(codePointString(0, 60, "lastName must be at most 60 characters"))
  .optional();

// Passwords are counted as Unicode code points. Do not trim or normalize them.
export const passwordSchema = codePointString(
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  `password must be ${PASSWORD_MIN_LENGTH}-${PASSWORD_MAX_LENGTH} characters`,
);

export const outletStaffLoginSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
});
export type OutletStaffLoginInput = z.infer<typeof outletStaffLoginSchema>;

export type StaffIdentity = {
  id: string;
  username: string;
  firstName: string;
  lastName: string | null;
  displayName: string;
  role: string;
};
export type OutletIdentity = { id: string; name: string; slug: string };
export type StaffLoginResponse = {
  ok: true;
  staff: StaffIdentity;
  outlet: OutletIdentity;
  role: string;
};

export const customerPhoneSchema = z
  .string()
  .transform((value) => value.replace(/[\s()-]/g, ""))
  .pipe(z.string().regex(/^\+[0-9]{8,15}$/, "phone must start with + and contain 8-15 digits"));

export const customerSignupSchema = z.object({
  phone: customerPhoneSchema,
  firstName: firstNameSchema,
  lastName: lastNameSchema,
  password: passwordSchema,
});
export type CustomerSignupInput = z.infer<typeof customerSignupSchema>;

export const customerLoginSchema = z.object({
  phone: customerPhoneSchema,
  password: passwordSchema,
});
export type CustomerLoginInput = z.infer<typeof customerLoginSchema>;

export const customerPasswordSchema = z.object({
  currentPassword: passwordSchema,
  newPassword: passwordSchema,
});

export type CustomerIdentity = {
  id: string;
  phone: string;
  firstName: string;
  lastName: string | null;
  displayName: string;
};

export type CustomerAuthResponse = { ok: true; customer: CustomerIdentity };
