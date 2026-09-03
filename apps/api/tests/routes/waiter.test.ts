import { describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { generateBill } from "../../src/services/settle.js";
import { seed, type FakeDb } from "../helpers/fakeRepos.js";
import type { Repos } from "../../src/repositories/index.js";
import { staffHeader } from "../helpers/staffCookie.js";

function seated(): {
  data: FakeDb;
  repos: Repos;
  sessionId: string;
  tableId: string;
  outletId: string;
} {
  const { data, repos, ids } = seed();
  const sessionId = "aaaaaaaa-6666-0000-0000-000000000001";
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
  const orderId = "bbbbbbbb-6666-0000-0000-000000000001";
  data.orders.push({
    id: orderId,
    session_id: sessionId,
    outlet_id: ids.outlet,
    status: "served",
    total_inr: 400,
    placed_via: "ui",
    created_at: new Date().toISOString(),
    placed_by: null,
    lang: "en",
  });
  data.order_items.push({
    id: "cccccccc-6666-0000-0000-000000000001",
    order_id: orderId,
    menu_item_id: ids.items[0],
    name: "Paneer Tikka",
    unit_price: 400,
    qty: 1,
    notes: null,
    status: "served",
    gst_pct: 5,
  });
  return { data, repos, sessionId, tableId: ids.tableA as string, outletId: ids.outlet };
}

describe("GET /api/waiter", () => {
  it("200s for waiter and shows the board", async () => {
    const { data, repos, tableId } = seated();
    const app = buildApp({ repos });
    const res = await app.inject({
      url: "/api/waiter",
      headers: { cookie: staffHeader(data, "waiter") },
    });
    expect(res.statusCode).toBe(200);
    expect(
      res.json().tables.find((t: { tableId: string }) => t.tableId === tableId)?.session,
    ).toBeTruthy();
  });

  it("403s a role waiter excludes", async () => {
    const { data, repos } = seated();
    const app = buildApp({ repos });
    const res = await app.inject({
      url: "/api/waiter",
      headers: { cookie: staffHeader(data, "cashier") },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe("PATCH /api/waiter", () => {
  it("marks an order served", async () => {
    const { data, repos, sessionId } = seated();
    data.orders[0].status = "ready";
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "PATCH",
      url: "/api/waiter",
      headers: { cookie: staffHeader(data, "waiter") },
      payload: { action: "mark_served", orderId: data.orders[0].id },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    expect(data.orders.find((o) => o.session_id === sessionId)?.status).toBe("served");
  });

  it("records a payment against a raised bill", async () => {
    const { data, repos, sessionId, outletId } = seated();
    await generateBill(repos, sessionId, outletId);
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "PATCH",
      url: "/api/waiter",
      headers: { cookie: staffHeader(data, "waiter") },
      payload: {
        action: "record_payment",
        sessionId,
        method: "cash",
        collectedBy: "attacker-controlled name",
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true, closed: true });
    expect(data.sessions.find((s) => s.id === sessionId)?.status).toBe("closed");
    expect(data.payments[0]?.reference).toContain("collected by Demo Waiter");
    expect(data.payments[0]?.reference).not.toContain("attacker-controlled name");
  });

  it("400s an unknown action", async () => {
    const { data, repos } = seated();
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "PATCH",
      url: "/api/waiter",
      headers: { cookie: staffHeader(data, "waiter") },
      payload: { action: "bogus" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "invalid action" });
  });

  it("400s a recognized action missing its required field", async () => {
    const { data, repos } = seated();
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "PATCH",
      url: "/api/waiter",
      headers: { cookie: staffHeader(data, "waiter") },
      payload: { action: "mark_served" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "invalid action" });
  });

  it("403s a role waiter excludes", async () => {
    const { data, repos } = seated();
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "PATCH",
      url: "/api/waiter",
      headers: { cookie: staffHeader(data, "reception") },
      payload: { action: "clear_table", tableId: "x" },
    });
    expect(res.statusCode).toBe(403);
  });
});
