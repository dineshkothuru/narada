import type { Repos } from "../repositories/index.js";
import { badRequest, notFound } from "../lib/http.js";
import type {
  AdminOrderRow,
  AdminOrdersResponse,
  CreateCategoryInput,
  PatchSettingsInput,
} from "@narada/shared";

// Port of web/app/api/admin/categories/route.ts.
export async function createCategory(
  repos: Pick<Repos, "outlets" | "menuCategories">,
  input: CreateCategoryInput,
): Promise<{ ok: true; id: string }> {
  const name = input.name.trim();
  if (!name) throw badRequest("name required");

  const outlet = await repos.outlets.findFirst();
  if (!outlet) throw notFound("no outlet");

  const maxSort = await repos.menuCategories.maxSortOrder();
  const created = await repos.menuCategories.create({
    outlet_id: outlet.id,
    name: name.slice(0, 60),
    emoji: (input.emoji || "🍽️").slice(0, 8),
    kind: input.kind === "drink" ? "drink" : "food",
    sort_order: maxSort + 1,
  });
  return { ok: true, id: created.id };
}

// Deleting a section cascades to its items; when history blocks the FK the
// legacy route hid the section's dishes instead — the repo layer has no FK
// awareness, so we always hide-on-delete-failure via a distinct catch.
export async function deleteCategory(
  repos: Pick<Repos, "menuCategories" | "menuItems">,
  id: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!id) throw badRequest("id required");
  try {
    await repos.menuCategories.remove(id);
    return { ok: true };
  } catch {
    await repos.menuItems.hideByCategory(id);
    return {
      ok: false,
      reason: "Section has dishes with past orders — its dishes were marked unavailable instead.",
    };
  }
}

// Port of web/app/api/admin/orders/route.ts. Owner view: every order with its
// table, session and payment state, plus derived stats.
export async function listAdminOrders(
  repos: Pick<Repos, "orders">,
  range: "today" | "week" | "all" | undefined,
): Promise<AdminOrdersResponse> {
  let since: string | null = null;
  if (range === "week") {
    since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  } else if (range !== "all") {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    since = d.toISOString();
  }

  const rows = await repos.orders.listForAdmin(since);
  const orders: AdminOrderRow[] = rows.map((o) => ({
    id: o.id,
    status: o.status,
    total_inr: Number(o.total_inr),
    placed_via: o.placed_via,
    placed_by: o.placed_by,
    created_at: o.created_at,
    session: o.session
      ? {
          id: o.session.id,
          status: o.session.status,
          discount_pct: Number(o.session.discount_pct),
          table: o.session.table ? { label: o.session.table.label } : null,
          payments: o.session.payments.map((p) => ({
            amount_inr: Number(p.amount_inr),
            status: p.status,
            method: p.method,
          })),
        }
      : null,
    items: o.items.map((it) => ({
      name: it.name,
      qty: Number(it.qty),
      unit_price: Number(it.unit_price),
      status: it.status,
    })),
  }));

  const live = orders.filter((o) => o.status !== "cancelled");
  const gross = live.reduce((s, o) => s + o.total_inr, 0);

  // one discount per session — count it once, not per round
  const sessions = new Map<string, { gross: number; pct: number; paid: number }>();
  for (const o of live) {
    const sid = o.session?.id;
    if (!sid) continue;
    const cur = sessions.get(sid) ?? {
      gross: 0,
      pct: o.session?.discount_pct ?? 0,
      paid: (o.session?.payments ?? [])
        .filter((p) => p.status === "confirmed")
        .reduce((s, p) => s + p.amount_inr, 0),
    };
    cur.gross += o.total_inr;
    sessions.set(sid, cur);
  }

  let netExpected = 0;
  let collected = 0;
  for (const s of sessions.values()) {
    netExpected += Math.round(s.gross * (1 - s.pct / 100));
    collected += s.paid;
  }

  const dishCount = new Map<string, number>();
  for (const o of live) {
    for (const it of o.items) {
      dishCount.set(it.name, (dishCount.get(it.name) ?? 0) + it.qty);
    }
  }
  const topDishes = [...dishCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, qty]) => ({ name, qty }));

  return {
    orders,
    stats: {
      orders: live.length,
      tables: sessions.size,
      gross,
      netExpected,
      collected,
      outstanding: Math.max(0, netExpected - collected),
      byVoice: live.filter((o) => o.placed_via === "anna").length,
      avgTable: sessions.size ? Math.round(netExpected / sessions.size) : 0,
      topDishes,
    },
  };
}

// Port of web/app/api/admin/settings/route.ts. Allow-list mirrors the legacy
// route exactly — an unrecognised or malformed field is silently dropped, not
// a 400, matching legacy behaviour.
export async function updateSettings(
  repos: Pick<Repos, "outlets">,
  input: PatchSettingsInput,
): Promise<{ ok: true }> {
  if (!input.outletId) throw badRequest("outletId required");

  const patch: Record<string, unknown> = {};
  if (input.payment_timing === "pre" || input.payment_timing === "post") {
    patch.payment_timing = input.payment_timing;
  }
  if (typeof input.upi_vpa === "string" && input.upi_vpa.includes("@")) {
    patch.upi_vpa = input.upi_vpa;
  }
  if (typeof input.admin_pin === "string" && input.admin_pin.length >= 4) {
    patch.admin_pin = input.admin_pin;
  }
  if (
    typeof input.service_charge_pct === "number" &&
    input.service_charge_pct >= 0 &&
    input.service_charge_pct <= 20
  ) {
    patch.service_charge_pct = input.service_charge_pct;
  }
  if (typeof input.gstin === "string") {
    patch.gstin = input.gstin.trim().slice(0, 20) || null;
  }
  if (input.comp_item_id === null || typeof input.comp_item_id === "string") {
    patch.comp_item_id = input.comp_item_id || null;
  }
  if (typeof input.gemini_api_key === "string") {
    patch.gemini_api_key = input.gemini_api_key || null;
  }
  if (typeof input.sarvam_api_key === "string") {
    patch.sarvam_api_key = input.sarvam_api_key || null;
  }
  if (Object.keys(patch).length === 0) throw badRequest("nothing to update");

  await repos.outlets.update(input.outletId, patch);
  return { ok: true };
}
