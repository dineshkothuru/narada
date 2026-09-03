import { spinWheel, WHEEL } from "@narada/shared";
import { HttpError, notFound } from "../lib/http.js";
import type { Repos } from "../repositories/index.js";
import { getOrCreateSession, lookupTable } from "./tableSession.js";

// Port of web/app/api/reward/route.ts. Rewards are server-authoritative per
// table session: the server draws the wheel prize and claims are atomic
// conditional updates (sessions.claimDiscount / claimComp), so a race between
// two phones on the same table can't double-award.

const FALLBACK_COMP_NAME = "Gulab Jamun (2 pcs)";

type RewardRepos = Pick<
  Repos,
  "tables" | "sessions" | "orders" | "orderItems" | "outlets" | "menuItems"
>;

export type SpinResult = { ok: boolean; discountPct: number; sliceIndex: number };
// "no orders yet" carries a 400 status at the route layer, unlike the other
// ok:false branches (200) — see routes/reward.ts.
export type CompResult =
  { ok: true; item: string } | { ok: false; reason: "no orders yet" | "already awarded" };

export async function spin(repos: RewardRepos, tableCode: string): Promise<SpinResult> {
  const table = await lookupTable(repos, tableCode);
  if (!table) throw notFound("unknown table");
  const session = await getOrCreateSession(repos, table);

  if (session.discount_pct > 0) {
    const idx = WHEEL.findIndex(
      (s) => s.reward.type === "discount" && s.reward.pct === session.discount_pct,
    );
    return { ok: false, discountPct: session.discount_pct, sliceIndex: idx >= 0 ? idx : 0 };
  }

  const sliceIndex = spinWheel();
  const reward = WHEEL[sliceIndex].reward;
  const pct = reward.type === "discount" ? reward.pct : 0;
  if (pct > 0) {
    const claimed = await repos.sessions.claimDiscount(session.id, pct);
    if (!claimed) {
      const current = await repos.sessions.findById(session.id);
      return { ok: false, discountPct: Number(current?.discount_pct ?? 0), sliceIndex };
    }
  }
  return { ok: true, discountPct: pct, sliceIndex };
}

export async function claimComp(repos: RewardRepos, tableCode: string): Promise<CompResult> {
  const table = await lookupTable(repos, tableCode);
  if (!table) throw notFound("unknown table");
  const session = await getOrCreateSession(repos, table);

  const hasOrders = await repos.orders.existsForSession(session.id);
  if (!hasOrders) return { ok: false, reason: "no orders yet" };

  const claimed = await repos.sessions.claimComp(session.id);
  if (!claimed) return { ok: false, reason: "already awarded" };

  const outlet = await repos.outlets.findById(table.outlet_id);
  let item: { id: string; name: string } | null = null;
  if (outlet?.comp_item_id) {
    item = await repos.menuItems.findById(outlet.comp_item_id);
  }
  if (!item) {
    item = await repos.menuItems.findByName(table.outlet_id, FALLBACK_COMP_NAME);
  }
  if (!item) {
    // matches the legacy 500 — the outlet's menu is misconfigured, not the
    // customer's fault, but we have nothing to hand over
    throw new HttpError(500, "comp item missing");
  }

  const compOrder = await repos.orders.create({
    session_id: session.id,
    outlet_id: table.outlet_id,
    total_inr: 0,
    placed_via: "ui",
  });
  await repos.orderItems.createMany([
    {
      order_id: compOrder.id,
      menu_item_id: item.id,
      name: item.name,
      unit_price: 0,
      qty: 1,
      notes: "🎁 Complimentary — Memory Match winner",
    },
  ]);
  return { ok: true, item: item.name };
}
