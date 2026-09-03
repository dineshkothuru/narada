import { orderToken } from "@narada/shared";
import { describe, expect, it, vi } from "vitest";
import { buildApp } from "../../src/app.js";
import { seed } from "../helpers/fakeRepos.js";

describe("POST /api/order", () => {
  it("places an order and returns the order summary", async () => {
    const { repos, ids } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "POST",
      url: "/api/order",
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
    expect(res.statusCode).toBe(404);
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
    vi.spyOn(repos.tables, "findByCode").mockRejectedValue(new Error("db down"));
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "POST",
      url: "/api/order",
      payload: { tableCode: "t1-demo", cart: [{ itemId: ids.items[0], qty: 1 }] },
    });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ error: "could not place order" });
  });
});

describe("GET /api/order", () => {
  it("returns the whole session's rounds", async () => {
    const { repos, ids } = seed();
    const app = buildApp({ repos });
    const placed = await app.inject({
      method: "POST",
      url: "/api/order",
      payload: { tableCode: "t1-demo", cart: [{ itemId: ids.items[0], qty: 1 }] },
    });
    const { sessionId } = placed.json();
    const res = await app.inject({ method: "GET", url: `/api/order?session=${sessionId}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().rounds).toHaveLength(1);
    expect(res.json().rounds[0].orderNo).toBe(orderToken(res.json().rounds[0].id));
  });

  it("returns a single order's status", async () => {
    const { repos, ids } = seed();
    const app = buildApp({ repos });
    const placed = await app.inject({
      method: "POST",
      url: "/api/order",
      payload: { tableCode: "t1-demo", cart: [{ itemId: ids.items[0], qty: 1 }] },
    });
    const { orderId } = placed.json();
    const res = await app.inject({ method: "GET", url: `/api/order?id=${orderId}` });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "placed" });
  });

  it("400s when neither id nor session is given", async () => {
    const { repos } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({ method: "GET", url: "/api/order" });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "id or session required" });
  });

  it("404s for an unknown order id", async () => {
    const { repos } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "GET",
      url: "/api/order?id=99999999-9999-9999-9999-999999999999",
    });
    expect(res.statusCode).toBe(404);
  });

  it("maps an unexpected repository failure to the legacy error", async () => {
    const { repos } = seed();
    vi.spyOn(repos.orders, "listBySessionWithItems").mockRejectedValue(new Error("db down"));
    const app = buildApp({ repos });
    const res = await app.inject({ method: "GET", url: "/api/order?session=s1" });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ error: "lookup failed" });
  });
});
