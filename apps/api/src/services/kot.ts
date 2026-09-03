import type { KotOrder } from "@narada/shared";
import type { Repos } from "../repositories/index.js";
import { notFound } from "../lib/http.js";

export async function kitchenKot(
  repos: Pick<Repos, "orders">,
  orderId: string,
  outletId: string,
): Promise<KotOrder & { cancelledCount: number; tableLabel: string }> {
  const order = await repos.orders.findForKot(orderId, outletId);
  if (!order) throw notFound("unknown order");
  const cancelledCount = order.items.filter((item) => item.status === "cancelled").length;
  const tableLabel = order.session?.table?.label ?? "Takeaway";
  return {
    ...order,
    total_inr: Number(order.total_inr),
    tableLabel,
    cancelledCount,
    session: order.session,
    items: order.items.filter((item) => item.status !== "cancelled"),
  };
}
