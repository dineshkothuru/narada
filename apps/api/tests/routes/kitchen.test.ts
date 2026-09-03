import { describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { ADMIN_COOKIE, roleToken } from "../../src/plugins/auth.js";
import { seed } from "../helpers/fakeRepos.js";

const cookieFor = async (role: "kitchen" | "waiter" | "admin" | "cashier" | "reception") =>
  `${ADMIN_COOKIE}=${await roleToken(role)}`;

function ticketFixture() {
  const { data, repos, ids } = seed();
  const sessionId = "aaaaaaaa-5555-0000-0000-000000000001";
  data.sessions.push({
    id: sessionId,
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
  const orderId = "bbbbbbbb-5555-0000-0000-000000000001";
  data.orders.push({
    id: orderId,
    session_id: sessionId,
    outlet_id: ids.outlet,
    status: "placed",
    total_inr: 400,
    placed_via: "ui",
    created_at: new Date().toISOString(),
    placed_by: null,
    lang: "en",
  });
  const itemId = "cccccccc-5555-0000-0000-000000000001";
  data.order_items.push({
    id: itemId,
    order_id: orderId,
    menu_item_id: ids.items[0],
    name: "Paneer Tikka",
    unit_price: 400,
    qty: 1,
    notes: null,
    status: "queued",
    gst_pct: 5,
  });
  return { data, repos, orderId, itemId };
}

describe("GET /api/kitchen", () => {
  it("200s for kitchen and lists open tickets", async () => {
    const { repos, orderId } = ticketFixture();
    const app = buildApp({ repos });
    const res = await app.inject({
      url: "/api/kitchen",
      headers: { cookie: await cookieFor("kitchen") },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().orders.map((o: { id: string }) => o.id)).toContain(orderId);
  });

  it("403s a role kitchen excludes", async () => {
    const { repos } = ticketFixture();
    const app = buildApp({ repos });
    const res = await app.inject({
      url: "/api/kitchen",
      headers: { cookie: await cookieFor("waiter") },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe("PATCH /api/kitchen", () => {
  it("advances a whole ticket", async () => {
    const { data, repos, orderId } = ticketFixture();
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "PATCH",
      url: "/api/kitchen",
      headers: { cookie: await cookieFor("kitchen") },
      payload: { orderId, status: "served" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    expect(data.orders.find((o) => o.id === orderId)?.status).toBe("served");
  });

  it("advances a single dish and derives the ticket status", async () => {
    const { repos, itemId } = ticketFixture();
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "PATCH",
      url: "/api/kitchen",
      headers: { cookie: await cookieFor("kitchen") },
      payload: { itemId, itemStatus: "preparing" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, orderStatus: "preparing" });
  });

  it("400s an invalid status", async () => {
    const { repos, orderId } = ticketFixture();
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "PATCH",
      url: "/api/kitchen",
      headers: { cookie: await cookieFor("kitchen") },
      payload: { orderId, status: "bogus" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "orderId and valid status required" });
  });

  it("403s a role kitchen excludes", async () => {
    const { repos, orderId } = ticketFixture();
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "PATCH",
      url: "/api/kitchen",
      headers: { cookie: await cookieFor("reception") },
      payload: { orderId, status: "served" },
    });
    expect(res.statusCode).toBe(403);
  });
});
