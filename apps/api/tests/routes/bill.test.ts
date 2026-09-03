import { describe, expect, it, vi } from "vitest";
import { buildApp } from "../../src/app.js";
import { seed } from "../helpers/fakeRepos.js";
import { staffCookie } from "../helpers/staffCookie.js";
import { customerCookieForSession } from "../helpers/customerCookie.js";

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
  return { data, repos, sessionId, outletId: ids.outlet };
}

describe("GET /api/bill", () => {
  it("returns the computed bill with its rounds", async () => {
    const { repos, sessionId, outletId } = tableWithOrder();
    const app = buildApp({ repos });
    const cookies = customerCookieForSession(sessionId, outletId);
    const res = await app.inject({
      method: "GET",
      url: `/api/bill?session=${sessionId}&tableCode=t1-demo`,
      cookies,
    });
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

  it("requires and verifies the anonymous table code", async () => {
    const { repos, sessionId } = tableWithOrder();
    const app = buildApp({ repos });
    const missing = await app.inject({ method: "GET", url: `/api/bill?session=${sessionId}` });
    expect(missing.statusCode).toBe(401);
    const wrong = await app.inject({
      method: "GET",
      url: `/api/bill?session=${sessionId}&tableCode=t2-demo`,
    });
    expect(wrong.statusCode).toBe(401);
    expect(wrong.json()).toEqual({ error: "customer session required" });
  });

  it("allows a staff bill read without a table code, scoped to its outlet", async () => {
    const { data, repos, sessionId } = tableWithOrder();
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "GET",
      url: `/api/bill?session=${sessionId}`,
      cookies: staffCookie(data, "admin"),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().gross).toBe(280);
  });

  it("does not let staff read a session from another outlet", async () => {
    const { data, repos } = tableWithOrder();
    const otherOutlet = "44444444-4444-4444-4444-444444444444";
    const otherTable = "55555555-5555-5555-5555-555555555555";
    const otherSession = "66666666-6666-6666-6666-666666666666";
    data.outlets.push({
      id: otherOutlet,
      name: "Other Outlet",
      slug: "other-outlet",
      active: true,
      service_charge_pct: 5,
      gstin: null,
      bill_seq: 0,
    });
    data.tables.push({
      id: otherTable,
      outlet_id: otherOutlet,
      label: "Other Table",
      code: "other-table",
    });
    data.sessions.push({
      id: otherSession,
      table_id: otherTable,
      outlet_id: otherOutlet,
      status: "active",
      discount_pct: 0,
      comp_awarded: false,
      service_waived: false,
      bill_tip: null,
      bill_no: null,
      settled_at: null,
      attendant: null,
    });
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "GET",
      url: `/api/bill?session=${otherSession}`,
      cookies: staffCookie(data, "admin"),
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "session required" });
  });

  it("maps an unexpected repository failure to the legacy error", async () => {
    const { repos, sessionId, outletId } = tableWithOrder();
    vi.spyOn(repos.sessions, "findForBilling").mockRejectedValue(new Error("db down"));
    const app = buildApp({ repos });
    const cookies = customerCookieForSession(sessionId, outletId);
    const res = await app.inject({
      method: "GET",
      url: `/api/bill?session=${sessionId}&tableCode=t1-demo`,
      cookies,
    });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ error: "failed" });
  });
});

describe("PATCH /api/bill", () => {
  it("waives the service charge", async () => {
    const { repos, sessionId, outletId } = tableWithOrder();
    const app = buildApp({ repos });
    const cookies = customerCookieForSession(sessionId, outletId);
    const res = await app.inject({
      method: "PATCH",
      url: "/api/bill",
      cookies,
      payload: { sessionId, tableCode: "t1-demo", serviceWaived: true },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().serviceWaived).toBe(true);
    expect(res.json().service).toBe(0);
  });

  it("patches the primary bill while authorizing through a merged child", async () => {
    const { data, repos, sessionId, outletId } = tableWithOrder();
    const primaryId = "77777777-7777-7777-7777-777777777777";
    data.sessions.push({
      id: primaryId,
      table_id: data.tables.find((table) => table.code === "t2-demo")!.id,
      outlet_id: outletId,
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
    data.sessions.find((session) => session.id === sessionId)!.merged_into = primaryId;
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "PATCH",
      url: "/api/bill",
      cookies: customerCookieForSession(sessionId, outletId),
      payload: { sessionId, tableCode: "t1-demo", serviceWaived: true },
    });
    expect(res.statusCode).toBe(200);
    expect(data.sessions.find((session) => session.id === primaryId)?.service_waived).toBe(true);
    expect(data.sessions.find((session) => session.id === sessionId)?.service_waived).toBe(false);
  });

  it("400s when there is nothing to update", async () => {
    const { repos, sessionId, outletId } = tableWithOrder();
    const app = buildApp({ repos });
    const cookies = customerCookieForSession(sessionId, outletId);
    const res = await app.inject({
      method: "PATCH",
      url: "/api/bill",
      cookies,
      payload: { sessionId, tableCode: "t1-demo" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "nothing to update" });
  });

  it("silently drops a wrong-typed serviceWaived, matching legacy's typeof guard", async () => {
    const { repos, sessionId, outletId } = tableWithOrder();
    const app = buildApp({ repos });
    const cookies = customerCookieForSession(sessionId, outletId);
    const res = await app.inject({
      method: "PATCH",
      url: "/api/bill",
      cookies,
      payload: { sessionId, tableCode: "t1-demo", serviceWaived: "yes" },
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
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: "customer session required" });
    expect(data.sessions.find((s) => s.id === sessionId)?.service_waived).toBe(false);
  });

  it("requires a table code for anonymous bill patches", async () => {
    const { repos, sessionId } = tableWithOrder();
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "PATCH",
      url: "/api/bill",
      payload: { sessionId, serviceWaived: true },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: "customer session required" });
  });

  it("maps an unexpected repository failure to the legacy error", async () => {
    const { repos, sessionId, outletId } = tableWithOrder();
    vi.spyOn(repos.sessions, "updateIfUnbilled").mockRejectedValue(new Error("db down"));
    const app = buildApp({ repos });
    const cookies = customerCookieForSession(sessionId, outletId);
    const res = await app.inject({
      method: "PATCH",
      url: "/api/bill",
      cookies,
      payload: { sessionId, tableCode: "t1-demo", serviceWaived: true },
    });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ error: "failed" });
  });

  it("locks service and tip changes after a bill number is raised", async () => {
    const { data, repos, sessionId, outletId } = tableWithOrder();
    data.sessions[0].bill_no = "NAR-20260904-0001";
    const app = buildApp({ repos });
    const cookies = customerCookieForSession(sessionId, outletId);
    const res = await app.inject({
      method: "PATCH",
      url: "/api/bill",
      cookies,
      payload: { sessionId, tableCode: "t1-demo", serviceWaived: true, tip: 20 },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: "bill already raised" });
    expect(data.sessions[0].service_waived).toBe(false);
    expect(data.sessions[0].bill_tip).toBeNull();
  });
});
