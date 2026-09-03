import { describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { ADMIN_COOKIE, roleToken } from "../../src/plugins/auth.js";
import { seed, type FakeDb } from "../helpers/fakeRepos.js";
import type { Repos } from "../../src/repositories/index.js";

const cookieFor = async (role: "kitchen" | "waiter" | "admin" | "cashier" | "reception") =>
  `${ADMIN_COOKIE}=${await roleToken(role)}`;

function seated(): { data: FakeDb; repos: Repos; sessionId: string } {
  const { data, repos, ids } = seed();
  const sessionId = "aaaaaaaa-7777-0000-0000-000000000001";
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
    attendant: "Ravi",
    merged_into: null,
    service_waived: false,
    bill_no: null,
    bill_tip: null,
    tip_to: null,
    settled_at: null,
  });
  const orderId = "bbbbbbbb-7777-0000-0000-000000000001";
  data.orders.push({
    id: orderId,
    session_id: sessionId,
    outlet_id: ids.outlet,
    status: "served",
    total_inr: 400,
    placed_via: "ui",
    created_at: new Date().toISOString(),
    placed_by: null,
    lang: null,
  });
  data.order_items.push({
    id: "cccccccc-7777-0000-0000-000000000001",
    order_id: orderId,
    menu_item_id: ids.items[0],
    name: "Paneer Tikka",
    unit_price: 400,
    qty: 1,
    notes: null,
    status: "served",
    gst_pct: 5,
  });
  return { data, repos, sessionId };
}

describe("GET /api/counter", () => {
  it("200s for cashier and lists tabs", async () => {
    const { repos, sessionId } = seated();
    const app = buildApp({ repos });
    const res = await app.inject({
      url: "/api/counter",
      headers: { cookie: await cookieFor("cashier") },
    });
    expect(res.statusCode).toBe(200);
    expect(
      res.json().tabs.find((t: { sessionId: string }) => t.sessionId === sessionId),
    ).toBeTruthy();
  });

  it("403s a role counter excludes", async () => {
    const { repos } = seated();
    const app = buildApp({ repos });
    const res = await app.inject({
      url: "/api/counter",
      headers: { cookie: await cookieFor("waiter") },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe("PATCH /api/counter", () => {
  it("raises a bill then records a payment", async () => {
    const { data, repos, sessionId } = seated();
    const app = buildApp({ repos });

    const raise = await app.inject({
      method: "PATCH",
      url: "/api/counter",
      headers: { cookie: await cookieFor("cashier") },
      payload: { action: "generate_bill", sessionId },
    });
    expect(raise.statusCode).toBe(200);
    expect(raise.json().billNo).toMatch(/^NAR-/);

    const pay = await app.inject({
      method: "PATCH",
      url: "/api/counter",
      headers: { cookie: await cookieFor("cashier") },
      payload: { action: "record_payment", sessionId, method: "card" },
    });
    expect(pay.statusCode).toBe(200);
    expect(pay.json()).toMatchObject({ ok: true, closed: true });
    expect(data.sessions.find((s) => s.id === sessionId)?.status).toBe("closed");
  });

  it("409s raising a bill twice", async () => {
    const { repos, sessionId } = seated();
    const app = buildApp({ repos });
    await app.inject({
      method: "PATCH",
      url: "/api/counter",
      headers: { cookie: await cookieFor("cashier") },
      payload: { action: "generate_bill", sessionId },
    });
    const res = await app.inject({
      method: "PATCH",
      url: "/api/counter",
      headers: { cookie: await cookieFor("cashier") },
      payload: { action: "generate_bill", sessionId },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: "bill already raised" });
  });

  it("400s an unknown action", async () => {
    const { repos } = seated();
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "PATCH",
      url: "/api/counter",
      headers: { cookie: await cookieFor("cashier") },
      payload: { action: "bogus" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "invalid action" });
  });

  it("403s a role counter excludes", async () => {
    const { repos, sessionId } = seated();
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "PATCH",
      url: "/api/counter",
      headers: { cookie: await cookieFor("waiter") },
      payload: { action: "generate_bill", sessionId },
    });
    expect(res.statusCode).toBe(403);
  });
});
