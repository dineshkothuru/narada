import { spinWheel, WHEEL } from "@narada/shared";
import { conflict, HttpError, notFound } from "../lib/http.js";
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
> & { transaction?: Repos["transaction"] };

export type SpinResult = { ok: boolean; discountPct: number; sliceIndex: number };
// "no orders yet" carries a 400 status at the route layer, unlike the other
// ok:false branches (200) — see routes/reward.ts.
export type CompResult =
  { ok: true; item: string } | { ok: false; reason: "no orders yet" | "already awarded" };

export async function spin(
  repos: RewardRepos,
  tableCode: string,
  outletId?: string,
): Promise<SpinResult> {
  const table = await lookupTable(repos, tableCode, outletId);
  if (!table) throw notFound("unknown table");
  const session = await getOrCreateSession(repos, table);
  const primaryId = await repos.sessions.findPrimaryId(session.id, table.outlet_id);
  const current = primaryId ? await repos.sessions.findById(primaryId, table.outlet_id) : null;
  if (!current) throw notFound("unknown session");
  if (current.status !== "active" || current.bill_no) throw conflict("bill already raised");

  if (current.discount_pct > 0) {
    const idx = WHEEL.findIndex(
      (s) => s.reward.type === "discount" && s.reward.pct === current.discount_pct,
    );
    return { ok: false, discountPct: current.discount_pct, sliceIndex: idx >= 0 ? idx : 0 };
  }

  const sliceIndex = spinWheel();
  const reward = WHEEL[sliceIndex].reward;
  const pct = reward.type === "discount" ? reward.pct : 0;
  if (pct > 0) {
    const claimed = await repos.sessions.claimDiscount(primaryId!, pct, table.outlet_id);
    if (!claimed) {
      const latest = await repos.sessions.findById(primaryId!, table.outlet_id);
      return { ok: false, discountPct: Number(latest?.discount_pct ?? 0), sliceIndex };
    }
  }
  return { ok: true, discountPct: pct, sliceIndex };
}

export async function claimComp(
  repos: RewardRepos,
  tableCode: string,
  outletId?: string,
): Promise<CompResult> {
  const table = await lookupTable(repos, tableCode, outletId);
  if (!table) throw notFound("unknown table");
  const session = await getOrCreateSession(repos, table);
  const award = async (
    bound: Pick<Repos, "sessions" | "orders" | "orderItems" | "outlets" | "menuItems">,
  ): Promise<CompResult> => {
    const primaryId = await bound.sessions.findPrimaryId(session.id, table.outlet_id);
    if (!primaryId) throw notFound("unknown session");
    await bound.sessions.lockBillingGroup(primaryId, table.outlet_id);
    const current = await bound.sessions.findById(primaryId, table.outlet_id);
    if (!current) throw notFound("unknown session");
    if (current.status !== "active" || current.bill_no) throw conflict("bill already raised");

    const hasOrders = await bound.orders.existsForSession(primaryId, table.outlet_id);
    if (!hasOrders) return { ok: false, reason: "no orders yet" };
    const claimed = await bound.sessions.claimComp(primaryId, table.outlet_id);
    if (!claimed) return { ok: false, reason: "already awarded" };

    const outlet = await bound.outlets.findById(table.outlet_id);
    let item: { id: string; name: string } | null = null;
    if (outlet?.comp_item_id) {
      item = await bound.menuItems.findById(outlet.comp_item_id, table.outlet_id);
    }
    if (!item) item = await bound.menuItems.findByName(table.outlet_id, FALLBACK_COMP_NAME);
    if (!item) throw new HttpError(500, "comp item missing");

    const compOrder = await bound.orders.create({
      session_id: primaryId,
      outlet_id: table.outlet_id,
      total_inr: 0,
      placed_via: "ui",
    });
    await bound.orderItems.createMany([
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
  };
  return repos.transaction ? repos.transaction((bound) => award(bound)) : award(repos);
}
