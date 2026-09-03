import { deriveOrderStatus, orderToken } from "@narada/shared";
import { notFound } from "../lib/http.js";
import type { Repos } from "../repositories/index.js";

// Port of web/app/api/kitchen/route.ts.

export type KitchenOrderRow = Awaited<ReturnType<Repos["orders"]["listForKitchen"]>>[number] & {
  orderNo: string;
};

export async function kitchenOrders(
  repos: Pick<Repos, "orders">,
  limit = 60,
): Promise<KitchenOrderRow[]> {
  const orders = await repos.orders.listForKitchen(limit);
  return orders.map((order) => ({ ...order, orderNo: orderToken(order.id) }));
}

type KitchenRepos = Pick<Repos, "orders" | "orderItems">;

// Per-dish update: set the item, then derive the parent order's status from
// its siblings so the ticket never disagrees with its own dishes.
export async function updateItemStatus(
  repos: KitchenRepos,
  itemId: string,
  itemStatus: string,
): Promise<{ ok: true; orderStatus: string }> {
  const found = await repos.orderItems.findOrderId(itemId);
  if (!found) throw notFound("unknown item");

  await repos.orderItems.setStatus(itemId, itemStatus);
  const siblings = await repos.orderItems.listStatusesByOrder(found.order_id);
  const derived = deriveOrderStatus(siblings);
  await repos.orders.setStatus(found.order_id, derived);
  return { ok: true, orderStatus: derived };
}

// Whole-ticket advance drags every dish along with it: starting to cook moves
// every untouched dish to preparing, and ready/served move every dish at once.
export async function updateOrderStatus(
  repos: KitchenRepos,
  orderId: string,
  status: string,
): Promise<{ ok: true }> {
  await repos.orders.setStatus(orderId, status);
  if (status === "preparing") {
    await repos.orderItems.setStatusByOrderWhere(orderId, "queued", "preparing");
  } else if (status === "ready" || status === "served") {
    await repos.orderItems.setStatusByOrder(orderId, status);
  }
  return { ok: true };
}
