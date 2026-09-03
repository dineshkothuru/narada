import type {
  CustomerAuthResponse,
  CustomerIdentity,
  CustomerLoginInput,
  CustomerSignupInput,
} from "@narada/shared";
import type { Repos } from "../repositories/index.js";
import { HttpError } from "../lib/http.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import { customerAccountToken } from "../lib/customerAuth.js";

const DUMMY_PASSWORD_HASH =
  "scrypt$v=1$N=16384,r=8,p=5$aZd_uRPcpqGPxiRMOk2CCw$3ktJ2aAOVXnO3u4R-zEKxbQpvpH23VnBnrsfUHhDUdE";

type CustomerRow = {
  id: string;
  phone: string;
  first_name: string;
  last_name: string | null;
  password_hash: string;
};

const identity = (row: CustomerRow): CustomerIdentity => ({
  id: row.id,
  phone: row.phone,
  firstName: row.first_name,
  lastName: row.last_name,
  displayName: [row.first_name, row.last_name].filter(Boolean).join(" "),
});

export type CustomerAuthResult = CustomerAuthResponse & { token: string };

export async function signup(
  repos: Pick<Repos, "customers">,
  input: CustomerSignupInput,
): Promise<CustomerAuthResult | null> {
  try {
    const row = await repos.customers.create({
      phone: input.phone,
      first_name: input.firstName,
      last_name: input.lastName || null,
      password_hash: await hashPassword(input.password),
      active: true,
    });
    const customer = identity(row);
    return { ok: true, customer, token: customerAccountToken(customer.id) };
  } catch (error) {
    if ((error as { code?: string })?.code === "23505") return null;
    throw error;
  }
}

export async function login(
  repos: Pick<Repos, "customers">,
  input: CustomerLoginInput,
): Promise<CustomerAuthResult | null> {
  const account = await repos.customers.findActiveByPhone(input.phone);
  const passwordOk = await verifyPassword(
    account?.password_hash ?? DUMMY_PASSWORD_HASH,
    input.password,
  );
  if (!account || !passwordOk) return null;
  const customer = identity(account);
  return { ok: true, customer, token: customerAccountToken(customer.id) };
}

export async function changePassword(
  repos: Pick<Repos, "customers">,
  customerId: string,
  currentPassword: string,
  newPassword: string,
): Promise<{ ok: true }> {
  const row = await repos.customers.findActiveById(customerId);
  const currentOk = await verifyPassword(
    row?.password_hash ?? DUMMY_PASSWORD_HASH,
    currentPassword,
  );
  if (!row || !currentOk) throw new HttpError(401, "invalid credentials");
  await repos.customers.update(row.id, { password_hash: await hashPassword(newPassword) });
  return { ok: true };
}
