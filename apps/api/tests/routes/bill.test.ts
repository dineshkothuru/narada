import { describe, expect, it, vi } from "vitest";
import { buildApp } from "../../src/app.js";
import { seed } from "../helpers/fakeRepos.js";

function tableWithOrder() {
  const { data, repos, ids } = seed();
  const sessionId = "11111111-1111-1111-1111-111111111111";
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
  const orderId = "22222222-2222-2222-2222-222222222222";
  data.orders.push({
    id: orderId,
    session_id: sessionId,
    outlet_id: ids.outlet,
    status: "served",
    total_inr: 280,
    placed_via: "ui",
    created_at: new Date().toISOString(),
    placed_by: null,
    lang: "en",
  });
  data.order_items.push({
    id: "33333333-3333-3333-3333-333333333331",
    order_id: orderId,
    menu_item_id: ids.items[0],
    name: "Paneer Tikka",
    unit_price: 280,
    qty: 1,
    notes: null,
    status: "served",
    gst_pct: 5,
  });
  return { data, repos, sessionId };
}

describe("GET /api/bill", () => {
  it("returns the computed bill with its rounds", async () => {
    const { repos, sessionId } = tableWithOrder();
    const app = buildApp({ repos });
    const res = await app.inject({ method: "GET", url: `/api/bill?session=${sessionId}` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.gross).toBe(280);
    expect(body.rounds).toHaveLength(1);
  });

  it("400s when session is missing", async () => {
    const { repos } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({ method: "GET", url: "/api/bill" });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "session required" });
  });

  it("maps an unexpected repository failure to the legacy error", async () => {
    const { repos, sessionId } = tableWithOrder();
    vi.spyOn(repos.sessions, "findForBilling").mockRejectedValue(new Error("db down"));
    const app = buildApp({ repos });
    const res = await app.inject({ method: "GET", url: `/api/bill?session=${sessionId}` });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ error: "failed" });
  });
});

describe("PATCH /api/bill", () => {
  it("waives the service charge", async () => {
    const { repos, sessionId } = tableWithOrder();
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "PATCH",
      url: "/api/bill",
      payload: { sessionId, serviceWaived: true },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().serviceWaived).toBe(true);
    expect(res.json().service).toBe(0);
  });

  it("400s when there is nothing to update", async () => {
    const { repos, sessionId } = tableWithOrder();
    const app = buildApp({ repos });
    const res = await app.inject({ method: "PATCH", url: "/api/bill", payload: { sessionId } });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "nothing to update" });
  });

  it("silently drops a wrong-typed serviceWaived, matching legacy's typeof guard", async () => {
    const { repos, sessionId } = tableWithOrder();
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "PATCH",
      url: "/api/bill",
      payload: { sessionId, serviceWaived: "yes" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "nothing to update" });
  });

  it("400s with the legacy message when sessionId is missing", async () => {
    const { repos } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "PATCH",
      url: "/api/bill",
      payload: { serviceWaived: true },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "sessionId required" });
  });

  it("403s when the session doesn't belong to the given table", async () => {
    const { data, repos, sessionId } = tableWithOrder();
    const otherTable = data.tables.find((t) => t.code === "t2-demo")!;
    void otherTable;
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "PATCH",
      url: "/api/bill",
      payload: { sessionId, tableCode: "t2-demo", serviceWaived: true },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: "not your table" });
  });

  it("maps an unexpected repository failure to the legacy error", async () => {
    const { repos, sessionId } = tableWithOrder();
    vi.spyOn(repos.sessions, "update").mockRejectedValue(new Error("db down"));
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "PATCH",
      url: "/api/bill",
      payload: { sessionId, serviceWaived: true },
    });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ error: "failed" });
  });
});
