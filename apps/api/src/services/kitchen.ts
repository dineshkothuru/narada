import { deriveOrderStatus, orderToken } from "@narada/shared";
import { conflict, notFound } from "../lib/http.js";
import type { Repos } from "../repositories/index.js";

// Port of web/app/api/kitchen/route.ts.

export type KitchenOrderRow = Awaited<ReturnType<Repos["orders"]["listForKitchen"]>>[number] & {
  orderNo: string;
};

export async function kitchenOrders(
  repos: Pick<Repos, "orders">,
  limit = 60,
  outletId: string,
): Promise<KitchenOrderRow[]> {
  const orders = await repos.orders.listForKitchen(limit, outletId);
  return orders
    .filter((order) => order.status !== "cancelled")
    .map((order) => ({ ...order, orderNo: orderToken(order.id) }));
}

type KitchenRepos = Pick<Repos, "orders" | "orderItems"> & {
  transaction?: Repos["transaction"];
};

export async function updateWholeOrderStatus(
  repos: KitchenRepos,
  orderId: string,
  status: string,
  outletId: string,
): Promise<{ ok: true; orderStatus: string }> {
  const update = async (bound: Pick<Repos, "orders" | "orderItems">) => {
    if (!(await bound.orders.lockForItemStatus(orderId, outletId))) {
      throw notFound("unknown order");
    }
    if (status === "preparing") {
      await bound.orderItems.setStatusByOrderWhere(orderId, "queued", "preparing", outletId);
    } else if (status === "ready" || status === "served") {
      await bound.orderItems.setStatusByOrder(orderId, status, outletId);
    }
    const siblings = await bound.orderItems.listStatusesByOrder(orderId, outletId);
    const orderStatus = deriveOrderStatus(siblings);
    await bound.orders.setStatus(orderId, orderStatus, outletId);
    return { ok: true as const, orderStatus };
  };
  return repos.transaction ? repos.transaction((bound) => update(bound)) : update(repos);
}

// Per-dish update: set the item, then derive the parent order's status from
// its siblings so the ticket never disagrees with its own dishes.
export async function updateItemStatus(
  repos: KitchenRepos,
  itemId: string,
  itemStatus: string,
  outletId: string,
): Promise<{ ok: true; orderStatus: string }> {
  const update = async (bound: Pick<Repos, "orders" | "orderItems">) => {
    const found = await bound.orderItems.findOrderId(itemId, outletId);
    if (!found) throw notFound("unknown item");
    if (!(await bound.orders.lockForItemStatus(found.order_id, outletId))) {
      throw notFound("unknown item");
    }
    if (!(await bound.orderItems.setStatus(itemId, itemStatus, outletId))) {
      throw conflict("item cannot be updated");
    }
    const siblings = await bound.orderItems.listStatusesByOrder(found.order_id, outletId);
    const derived = deriveOrderStatus(siblings);
    await bound.orders.setStatus(found.order_id, derived, outletId);
    return { ok: true as const, orderStatus: derived };
  };
  return repos.transaction ? repos.transaction((bound) => update(bound)) : update(repos);
}

// Whole-ticket advance drags every dish along with it: starting to cook moves
// every untouched dish to preparing, and ready/served move every dish at once.
export async function updateOrderStatus(
  repos: KitchenRepos,
  orderId: string,
  status: string,
  outletId: string,
): Promise<{ ok: true }> {
  if (status === "cancelled") throw conflict("cancel items individually");
  await updateWholeOrderStatus(repos, orderId, status, outletId);
  return { ok: true };
}
