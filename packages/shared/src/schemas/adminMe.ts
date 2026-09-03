import type { OutletIdentity, StaffIdentity } from "./adminLogin.js";

export type AdminMeResponse = { role: string; staff: StaffIdentity; outlet: OutletIdentity };
