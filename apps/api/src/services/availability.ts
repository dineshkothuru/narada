import type { AvailabilityResponse } from "@narada/shared";
import type { Repos } from "../repositories/index.js";
import { notFound } from "../lib/http.js";

type AvailabilityRepos = Pick<Repos, "menuItems" | "audit">;

export async function availabilityBoard(
  repos: AvailabilityRepos,
  outletId: string,
): Promise<AvailabilityResponse> {
  const [menu, recent] = await Promise.all([
    repos.menuItems.listAvailability(outletId),
    repos.audit.listByActions(outletId, ["dish_sold_out", "dish_back_on"]),
  ]);
  return {
    menu,
    recent: recent.map((entry) => ({
      action: entry.action as "dish_sold_out" | "dish_back_on",
      role: entry.role,
      actor_name: entry.actor_name,
      details: (entry.details as Record<string, unknown> | null) ?? null,
      created_at: entry.created_at,
    })),
  };
}

export async function setAvailability(
  repos: AvailabilityRepos,
  input: { menuItemId: string; available: boolean },
  outletId: string,
  actor: { staffId: string; role: string; displayName: string },
) {
  const item = await repos.menuItems.findAvailability(input.menuItemId, outletId);
  if (!item) throw notFound("unknown dish");
  const updated = await repos.menuItems.setAvailability(
    input.menuItemId,
    input.available,
    outletId,
  );
  if (!updated) throw notFound("unknown dish");

  try {
    await repos.audit.create({
      outlet_id: outletId,
      staff_id: actor.staffId,
      role: actor.role,
      actor_name: actor.displayName.slice(0, 60),
      action: input.available ? "dish_back_on" : "dish_sold_out",
      entity_type: "menu_item",
      entity_id: input.menuItemId,
      details: { name: item.name },
    });
  } catch {
    // audit must not make a successful availability change look failed
  }
  return { ok: true as const, name: item.name };
}
