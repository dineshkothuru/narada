import { orderToken } from "@narada/shared";
import { describe, expect, it, vi } from "vitest";
import { buildApp } from "../../src/app.js";
import { staffToken } from "../../src/plugins/auth.js";
import { seed } from "../helpers/fakeRepos.js";
import { customerCookie, customerCookieForSession } from "../helpers/customerCookie.js";

describe("POST /api/order", () => {
  it("places an order and returns the order summary", async () => {
    const { repos, ids } = seed();
    const app = buildApp({ repos });
    const cookies = await customerCookie(app, "demo-spice-garden", "t1-demo");
    const res = await app.inject({
      method: "POST",
      url: "/api/order",
      cookies,
      payload: { tableCode: "t1-demo", cart: [{ itemId: ids.items[0], qty: 2 }] },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.total).toBe(560);
    expect(body.tableLabel).toBe("Table 1");
    expect(body.orderNo).toBe(orderToken(body.orderId));
  });

  it("400s when the cart is empty", async () => {
    const { repos } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "POST",
      url: "/api/order",
      payload: { tableCode: "t1-demo", cart: [] },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "tableCode and cart required" });
  });

  it("404s for an unknown table", async () => {
    const { repos, ids } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "POST",
      url: "/api/order",
      payload: { tableCode: "nope", cart: [{ itemId: ids.items[0], qty: 1 }] },
    });
    expect(res.statusCode).toBe(401);
  });

  it("400s with the legacy message when cart is malformed, not just empty", async () => {
    const { repos } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "POST",
      url: "/api/order",
      payload: { tableCode: "t1-demo", cart: "not-an-array" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "tableCode and cart required" });
  });

  it("maps an unexpected repository failure to the legacy error", async () => {
    const { repos, ids } = seed();
    const app = buildApp({ repos });
    const cookies = await customerCookie(app, "demo-spice-garden", "t1-demo");
    vi.spyOn(repos.sessions, "findById").mockRejectedValue(new Error("db down"));
    const res = await app.inject({
      method: "POST",
      url: "/api/order",
      cookies,
      payload: { tableCode: "t1-demo", cart: [{ itemId: ids.items[0], qty: 1 }] },
    });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ error: "could not place order" });
  });

  it("derives waiter placement and actor from the staff session", async () => {
    const { data, repos, ids } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "POST",
      url: "/api/order",
      headers: {
        cookie: `narada_staff=${staffToken(String(data.staff.find((s) => s.role === "waiter")!.id), ids.outlet, "waiter")}`,
      },
      payload: {
        tableCode: "t1-demo",
        placedVia: "anna",
        guestName: "spoofed actor",
        cart: [{ itemId: ids.items[0], qty: 1 }],
      },
    });
    expect(res.statusCode).toBe(200);
    expect(data.orders[0]).toMatchObject({ placed_via: "waiter", placed_by: "Demo Waiter" });
  });

  it("does not allow cashier or kitchen to place a table order", async () => {
    const { data, repos } = seed();
    const app = buildApp({ repos });
    for (const role of ["cashier", "kitchen"] as const) {
      const staff = data.staff.find((s) => s.role === role)!;
      const res = await app.inject({
        method: "POST",
        url: "/api/order",
        headers: {
          cookie: `narada_staff=${staffToken(String(staff.id), String(staff.outlet_id), role)}`,
        },
        payload: { tableCode: "t1-demo", cart: [{ itemId: data.menu_items[0].id, qty: 1 }] },
      });
      expect(res.statusCode).toBe(403);
    }
  });

  it("rejects a cashier even when a session id is supplied", async () => {
    const { data, repos } = seed();
    const app = buildApp({ repos });
    const staff = data.staff.find((s) => s.role === "cashier")!;
    const res = await app.inject({
      method: "POST",
      url: "/api/order",
      headers: {
        cookie: `narada_staff=${staffToken(String(staff.id), String(staff.outlet_id), "cashier")}`,
      },
      payload: { sessionId: "11111111-1111-1111-1111-111111111111" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("does not allow a customer to spoof waiter placement", async () => {
    const { data, repos, ids } = seed();
    const app = buildApp({ repos });
    const cookies = await customerCookie(app, "demo-spice-garden", "t1-demo");
    const res = await app.inject({
      method: "POST",
      url: "/api/order",
      cookies,
      payload: {
        placedVia: "waiter",
        cart: [{ itemId: ids.items[0], qty: 1 }],
      },
    });
    expect(res.statusCode).toBe(200);
    expect(data.orders[0]?.placed_via).toBe("ui");
  });
});

describe("DELETE /api/order", () => {
  it("lets a guest cancel only a queued item in its own session", async () => {
    const { data, repos, ids } = seed();
    const app = buildApp({ repos });
    const cookies = await customerCookie(app, "demo-spice-garden", "t1-demo");
    const placed = await app.inject({
      method: "POST",
      url: "/api/order",
      cookies,
      payload: { tableCode: "t1-demo", cart: [{ itemId: ids.items[0], qty: 1 }] },
    });
    const itemId = String(data.order_items[0].id);
    const res = await app.inject({ method: "DELETE", url: `/api/order?itemId=${itemId}`, cookies });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true, orderStatus: "cancelled" });
    expect(data.order_items[0].status).toBe("cancelled");
    expect(data.orders.find((o) => o.id === placed.json().orderId)?.status).toBe("cancelled");
    expect(data.audit_log[0]).toMatchObject({ action: "item_cancelled", role: "customer" });
    expect(res.json()).toMatchObject({ orderCancelled: true, name: "Paneer Tikka" });
  });

  it("hides another session's item from a valid guest capability", async () => {
    const { data, repos, ids } = seed();
    const app = buildApp({ repos });
    const ownCookies = await customerCookie(app, "demo-spice-garden", "t1-demo");
    const otherCookies = await customerCookie(app, "demo-spice-garden", "t2-demo");
    await app.inject({
      method: "POST",
      url: "/api/order",
      cookies: ownCookies,
      payload: { tableCode: "t1-demo", cart: [{ itemId: ids.items[0], qty: 1 }] },
    });
    const itemId = String(data.order_items[0].id);
    const res = await app.inject({
      method: "DELETE",
      url: `/api/order?itemId=${itemId}`,
      cookies: otherCookies,
    });
    expect(res.statusCode).toBe(404);
    expect(data.order_items[0].status).toBe("queued");
  });

  it("lets staff cancel preparing items and records the server actor", async () => {
    const { data, repos, ids } = seed();
    const app = buildApp({ repos });
    const cookies = await customerCookie(app, "demo-spice-garden", "t1-demo");
    await app.inject({
      method: "POST",
      url: "/api/order",
      cookies,
      payload: { tableCode: "t1-demo", cart: [{ itemId: ids.items[0], qty: 1 }] },
    });
    data.order_items[0].status = "preparing";
    const staff = data.staff.find((s) => s.role === "waiter")!;
    const res = await app.inject({
      method: "DELETE",
      url: `/api/order?itemId=${data.order_items[0].id}`,
      headers: { cookie: `narada_staff=${staffToken(String(staff.id), ids.outlet, "waiter")}` },
    });
    expect(res.statusCode).toBe(200);
    expect(data.order_items[0].cancelled_by).toBe("Demo Waiter");
    expect(data.audit_log[0]).toMatchObject({ staff_id: staff.id, role: "waiter" });
  });

  it("does not turn a committed cancellation into a retryable failure if audit fails", async () => {
    const { data, repos, ids } = seed();
    const app = buildApp({ repos });
    const cookies = await customerCookie(app, "demo-spice-garden", "t1-demo");
    await app.inject({
      method: "POST",
      url: "/api/order",
      cookies,
      payload: { tableCode: "t1-demo", cart: [{ itemId: ids.items[0], qty: 1 }] },
    });
    vi.spyOn(repos.audit, "create").mockRejectedValue(new Error("audit unavailable"));
    const res = await app.inject({
      method: "DELETE",
      url: `/api/order?itemId=${data.order_items[0].id}`,
      cookies,
    });
    expect(res.statusCode).toBe(200);
    expect(data.order_items[0].status).toBe("cancelled");
  });
});

describe("GET /api/order", () => {
  it("returns the whole session's rounds", async () => {
    const { repos, ids } = seed();
    const app = buildApp({ repos });
    const cookies = await customerCookie(app, "demo-spice-garden", "t1-demo");
    const placed = await app.inject({
      method: "POST",
      url: "/api/order",
      cookies,
      payload: { tableCode: "t1-demo", cart: [{ itemId: ids.items[0], qty: 1 }] },
    });
    const { sessionId } = placed.json();
    const res = await app.inject({
      method: "GET",
      url: `/api/order?session=${sessionId}&tableCode=t1-demo`,
      cookies,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().rounds).toHaveLength(1);
    expect(res.json().rounds[0].orderNo).toBe(orderToken(res.json().rounds[0].id));
    expect(res.json().rounds[0].items[0].id).toBeTruthy();
  });

  it("returns a single order's status", async () => {
    const { repos, ids } = seed();
    const app = buildApp({ repos });
    const cookies = await customerCookie(app, "demo-spice-garden", "t1-demo");
    const placed = await app.inject({
      method: "POST",
      url: "/api/order",
      cookies,
      payload: { tableCode: "t1-demo", cart: [{ itemId: ids.items[0], qty: 1 }] },
    });
    const { orderId } = placed.json();
    const res = await app.inject({
      method: "GET",
      url: `/api/order?id=${orderId}&tableCode=t1-demo`,
      cookies,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "placed" });
  });

  it("includes merged child rounds while authorizing the child session", async () => {
    const { data, repos, ids } = seed();
    const primary = await repos.sessions.create({ table_id: ids.tableB, outlet_id: ids.outlet });
    const child = await repos.sessions.create({ table_id: ids.tableA, outlet_id: ids.outlet });
    await repos.sessions.update(child.id, { merged_into: primary.id }, ids.outlet);
    const order = await repos.orders.create({
      session_id: child.id,
      outlet_id: ids.outlet,
      total_inr: 100,
      placed_via: "ui",
    });
    await repos.orderItems.createMany([
      {
        order_id: order.id,
        menu_item_id: ids.items[0],
        name: "Paneer Tikka",
        unit_price: 100,
        qty: 1,
        status: "queued",
        gst_pct: 5,
      },
    ]);
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "GET",
      url: `/api/order?session=${child.id}&tableCode=t1-demo`,
      cookies: customerCookieForSession(child.id, ids.outlet),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().rounds).toHaveLength(1);
    expect(data.sessions.find((session) => session.id === child.id)?.merged_into).toBe(primary.id);
  });

  it("does not return a session through a different table code", async () => {
    const { repos, ids } = seed();
    const placed = await repos.orders.create({
      session_id: (await repos.sessions.create({ table_id: ids.tableA, outlet_id: ids.outlet })).id,
      outlet_id: ids.outlet,
      total_inr: 1,
      placed_via: "ui",
    });
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "GET",
      url: `/api/order?session=${placed.session_id}&tableCode=t2-demo`,
    });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: "customer session required" });
  });

  it("does not return an order through a different table code", async () => {
    const { repos, ids } = seed();
    const session = await repos.sessions.create({ table_id: ids.tableA, outlet_id: ids.outlet });
    const order = await repos.orders.create({
      session_id: session.id,
      outlet_id: ids.outlet,
      total_inr: 1,
      placed_via: "ui",
    });
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "GET",
      url: `/api/order?id=${order.id}&tableCode=t2-demo`,
    });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: "customer session required" });
  });

  it("requires a table code for anonymous order reads", async () => {
    const { repos } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({ method: "GET", url: "/api/order?id=some-order" });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: "customer session required" });
  });

  it("400s when neither id nor session is given", async () => {
    const { repos } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({ method: "GET", url: "/api/order" });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: "customer session required" });
  });

  it("404s for an unknown order id", async () => {
    const { repos } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "GET",
      url: "/api/order?id=99999999-9999-9999-9999-999999999999&tableCode=t1-demo",
    });
    expect(res.statusCode).toBe(401);
  });

  it("maps an unexpected repository failure to the legacy error", async () => {
    const { repos, ids } = seed();
    const session = await repos.sessions.create({ table_id: ids.tableA, outlet_id: ids.outlet });
    const placed = await repos.orders.create({
      session_id: session.id,
      outlet_id: ids.outlet,
      total_inr: 1,
      placed_via: "ui",
    });
    void placed;
    // A real session is needed so authorization reaches the failing list query.
    vi.spyOn(repos.orders, "listBySessionWithItems").mockRejectedValue(new Error("db down"));
    const app = buildApp({ repos });
    const cookies = customerCookieForSession(session.id, ids.outlet);
    const res = await app.inject({
      method: "GET",
      url: `/api/order?session=${session.id}&tableCode=t1-demo`,
      cookies,
    });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ error: "lookup failed" });
  });
});
