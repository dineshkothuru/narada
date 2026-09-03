import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { seed } from "../helpers/fakeRepos.js";
import { staffHeader } from "../helpers/staffCookie.js";

describe("main parity staff routes", () => {
  it("scopes availability to the signed-in outlet and role", async () => {
    const { data, repos, ids } = seed();
    const app = buildApp({ repos });
    const allowed = await app.inject({
      url: "/api/availability",
      headers: { cookie: staffHeader(data, "kitchen") },
    });
    expect(allowed.statusCode).toBe(200);
    expect(allowed.json().menu).toHaveLength(3);

    const denied = await app.inject({
      url: "/api/availability",
      headers: { cookie: staffHeader(data, "waiter") },
    });
    expect(denied.statusCode).toBe(403);

    const foreignId = randomUUID();
    data.menu_items.push({
      id: foreignId,
      outlet_id: "bbbbbbbb-0000-0000-0000-000000000002",
      name: "Foreign dish",
      is_available: true,
    });
    const foreign = await app.inject({
      method: "PATCH",
      url: "/api/availability",
      headers: { cookie: staffHeader(data, "kitchen") },
      payload: { menuItemId: foreignId, available: false },
    });
    expect(foreign.statusCode).toBe(404);
    expect(data.menu_items.at(-1)?.is_available).toBe(true);
    expect(ids.outlet).toBeTruthy();
  });

  it("protects waiter menu by outlet and exposes the admin day report", async () => {
    const { data, repos } = seed();
    const app = buildApp({ repos });
    const menu = await app.inject({
      url: "/api/waiter/menu?table=t1-demo",
      headers: { cookie: staffHeader(data, "waiter") },
    });
    expect(menu.statusCode).toBe(200);
    expect(menu.json()).toMatchObject({ tableLabel: "Table 1" });

    const report = await app.inject({
      url: "/api/admin/report?day=2026-09-03",
      headers: { cookie: staffHeader(data, "admin") },
    });
    expect(report.statusCode).toBe(200);
    expect(report.json()).toMatchObject({ day: "2026-09-03", bills: 0, net: 0, variance: 0 });

    const badDate = await app.inject({
      url: "/api/admin/report?day=2026-02-30",
      headers: { cookie: staffHeader(data, "admin") },
    });
    expect(badDate.statusCode).toBe(400);
  });

  it("only lets the waiter serve a ready item", async () => {
    const { data, repos, ids } = seed();
    const orderId = randomUUID();
    const itemId = randomUUID();
    data.sessions.push({
      id: randomUUID(),
      table_id: ids.tableA,
      outlet_id: ids.outlet,
      status: "active",
      created_at: new Date().toISOString(),
      closed_at: null,
      discount_pct: 0,
      comp_awarded: false,
      guests: 2,
      attendant: null,
      merged_into: null,
      service_waived: false,
      bill_no: null,
      bill_tip: null,
      tip_to: null,
      settled_at: null,
    });
    data.orders.push({
      id: orderId,
      session_id: data.sessions.at(-1)!.id,
      outlet_id: ids.outlet,
      status: "preparing",
      total_inr: 280,
      placed_via: "ui",
      created_at: new Date().toISOString(),
      placed_by: null,
      lang: "en",
    });
    data.order_items.push({
      id: itemId,
      order_id: orderId,
      menu_item_id: ids.items[0],
      name: "Paneer Tikka",
      unit_price: 280,
      qty: 1,
      notes: null,
      status: "preparing",
      gst_pct: 5,
    });
    const app = buildApp({ repos });
    const early = await app.inject({
      method: "PATCH",
      url: "/api/waiter",
      headers: { cookie: staffHeader(data, "waiter") },
      payload: { action: "mark_item_served", itemId },
    });
    expect(early.statusCode).toBe(409);
    expect(data.order_items[0]?.status).toBe("preparing");

    data.order_items[0]!.status = "ready";
    const served = await app.inject({
      method: "PATCH",
      url: "/api/waiter",
      headers: { cookie: staffHeader(data, "waiter") },
      payload: { action: "mark_item_served", itemId },
    });
    expect(served.statusCode).toBe(200);
    expect(data.order_items[0]?.status).toBe("served");
  });
});
