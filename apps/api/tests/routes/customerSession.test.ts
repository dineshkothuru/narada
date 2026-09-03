import { describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { CUSTOMER_COOKIE } from "../../src/lib/customerCapability.js";
import { seed } from "../helpers/fakeRepos.js";

const cookieFrom = (res: { headers: Record<string, unknown> }) => {
  const value = res.headers["set-cookie"] as string | string[] | undefined;
  const first = Array.isArray(value) ? value[0] : value;
  return first?.split(";", 1)[0] ?? "";
};
const cookieHeader = (res: { headers: Record<string, unknown> }) => {
  const value = res.headers["set-cookie"] as string | string[] | undefined;
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
};

describe("outlet customer sessions", () => {
  it("starts takeaway ordering and sets an HttpOnly capability", async () => {
    const { repos } = seed();
    const res = await buildApp({ repos }).inject({
      method: "POST",
      url: "/api/outlet/demo-spice-garden/session",
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ serviceType: "takeaway", tableLabel: "Takeaway" });
    expect(cookieFrom(res)).toContain(`${CUSTOMER_COOKIE}=`);
    expect(cookieHeader(res)).toContain("HttpOnly");
  });

  it("starts dine-in only for a table owned by the outlet", async () => {
    const { repos } = seed();
    const res = await buildApp({ repos }).inject({
      method: "POST",
      url: "/api/outlet/demo-spice-garden/table/t1-demo/session",
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ serviceType: "dine_in", tableLabel: "Table 1" });
  });

  it("does not authorize an order with a bare session or table code", async () => {
    const { repos, ids } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "POST",
      url: "/api/order",
      payload: { tableCode: "t1-demo", cart: [{ itemId: ids.items[0], qty: 1 }] },
    });
    expect(res.statusCode).toBe(401);
  });

  it("authorizes orders with the issued capability", async () => {
    const { repos, ids } = seed();
    const app = buildApp({ repos });
    const started = await app.inject({
      method: "POST",
      url: "/api/outlet/demo-spice-garden/session",
      payload: {},
    });
    const cookie = cookieFrom(started);
    const res = await app.inject({
      method: "POST",
      url: "/api/order",
      cookies: { [CUSTOMER_COOKIE]: cookie.split("=", 2)[1] },
      payload: { cart: [{ itemId: ids.items[0], qty: 1 }] },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().tableLabel).toBe("Takeaway");
  });

  it("reuses an active takeaway session for the same browser", async () => {
    const { repos } = seed();
    const app = buildApp({ repos });
    const first = await app.inject({
      method: "POST",
      url: "/api/outlet/demo-spice-garden/session",
      payload: {},
    });
    const second = await app.inject({
      method: "POST",
      url: "/api/outlet/demo-spice-garden/session",
      cookies: { [CUSTOMER_COOKIE]: cookieFrom(first).split("=", 2)[1] },
      payload: {},
    });
    expect(second.json().sessionId).toBe(first.json().sessionId);
  });

  it("does not resume a dine-in cookie at the takeaway URL", async () => {
    const { repos } = seed();
    const app = buildApp({ repos });
    const table = await app.inject({
      method: "POST",
      url: "/api/outlet/demo-spice-garden/table/t1-demo/session",
      payload: {},
    });
    const cookie = cookieFrom(table).split("=", 2)[1];
    const resumed = await app.inject({
      method: "GET",
      url: "/api/outlet/demo-spice-garden/session",
      cookies: { [CUSTOMER_COOKIE]: cookie },
    });
    expect(resumed.statusCode).toBe(401);
    const takeaway = await app.inject({
      method: "POST",
      url: "/api/outlet/demo-spice-garden/session",
      cookies: { [CUSTOMER_COOKIE]: cookie },
      payload: {},
    });
    expect(takeaway.statusCode).toBe(200);
    expect(takeaway.json().serviceType).toBe("takeaway");
    expect(takeaway.json().sessionId).not.toBe(table.json().sessionId);
  });

  it("ignores a body tableCode on the base outlet session URL", async () => {
    const { repos } = seed();
    const res = await buildApp({ repos }).inject({
      method: "POST",
      url: "/api/outlet/demo-spice-garden/session",
      payload: { tableCode: "t1-demo" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().serviceType).toBe("takeaway");
  });

  it("does not expose an order from another session in the same outlet", async () => {
    const { repos, ids } = seed();
    const app = buildApp({ repos });
    const first = await app.inject({
      method: "POST",
      url: "/api/outlet/demo-spice-garden/session",
      payload: {},
    });
    const firstCookie = cookieFrom(first).split("=", 2)[1];
    const placed = await app.inject({
      method: "POST",
      url: "/api/order",
      cookies: { [CUSTOMER_COOKIE]: firstCookie },
      payload: { cart: [{ itemId: ids.items[0], qty: 1 }] },
    });
    const second = await app.inject({
      method: "POST",
      url: "/api/outlet/demo-spice-garden/session",
      payload: {},
    });
    const denied = await app.inject({
      method: "GET",
      url: `/api/order?id=${placed.json().orderId}`,
      cookies: { [CUSTOMER_COOKIE]: cookieFrom(second).split("=", 2)[1] },
    });
    expect(denied.statusCode).toBe(401);
  });

  it("discovers the outlet for an enabled table without authorizing anything", async () => {
    const { repos } = seed();
    const res = await buildApp({ repos }).inject({
      method: "GET",
      url: "/api/outlets/table/t1-demo",
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ outletSlug: "demo-spice-garden", tableCode: "t1-demo" });
  });

  it("rejects dine-in creation when the outlet disables tables", async () => {
    const { data, repos } = seed();
    data.outlets[0].tables_enabled = false;
    const res = await buildApp({ repos }).inject({
      method: "POST",
      url: "/api/outlet/demo-spice-garden/table/t1-demo/session",
      payload: {},
    });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: "unknown table" });
  });
});
