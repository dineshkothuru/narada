import "server-only";
import type { NextRequest } from "next/server";
import { sbFetch } from "./supabase-server";
import { ADMIN_COOKIE, verifyToken, type StaffRole } from "./admin-auth";

// Who did what, to money and to orders. Waiving a service charge, cancelling a
// dish, raising a bill and taking cash are all things an owner may need to ask
// about later, and "the device said Ravi" is not an answer — the role comes
// from the signed cookie, not from a name typed into a shared tablet.
export type AuditEntry = {
  action: string;
  entity?: string;
  entityId?: string | null;
  actorRole?: StaffRole | "guest" | null;
  actorName?: string | null;
  detail?: Record<string, unknown>;
  restaurantId?: string | null;
};

export async function actorFrom(req: NextRequest): Promise<StaffRole | "guest"> {
  return (await verifyToken(req.cookies.get(ADMIN_COOKIE)?.value)) ?? "guest";
}

// Logging must never break the action it is recording.
export async function audit(entry: AuditEntry): Promise<void> {
  try {
    await sbFetch(`audit_log`, {
      method: "POST",
      body: JSON.stringify({
        restaurant_id: entry.restaurantId ?? null,
        actor_role: entry.actorRole ?? null,
        actor_name: entry.actorName?.trim()?.slice(0, 60) ?? null,
        action: entry.action,
        entity: entry.entity ?? null,
        entity_id: entry.entityId ?? null,
        detail: entry.detail ?? null,
      }),
    });
  } catch (e) {
    console.error("audit:", entry.action, e);
  }
}
