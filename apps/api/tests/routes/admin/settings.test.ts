import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { buildApp } from "../../../src/app.js";
import { seed } from "../../helpers/fakeRepos.js";
import { staffCookie } from "../../helpers/staffCookie.js";

describe("PATCH /api/admin/settings", () => {
  it("updates outlet settings", async () => {
    const { data, repos, ids } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "PATCH",
      url: "/api/admin/settings",
      cookies: staffCookie(data, "admin"),
      payload: { outletId: ids.outlet, service_charge_pct: 10 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });

  it("normalizes an admin-edited outlet slug", async () => {
    const { data, repos, ids } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "PATCH",
      url: "/api/admin/settings",
      cookies: staffCookie(data, "admin"),
      payload: { slug: "  New-Spice-Garden " },
    });
    expect(res.statusCode).toBe(200);
    expect(data.outlets.find((outlet) => outlet.id === ids.outlet)?.slug).toBe("new-spice-garden");
  });

  it("400s with nothing to update", async () => {
    const { data, repos, ids } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "PATCH",
      url: "/api/admin/settings",
      cookies: staffCookie(data, "admin"),
      payload: { outletId: ids.outlet },
    });
    expect(res.statusCode).toBe(400);
  });

  it("uses the session outlet instead of a client-supplied outletId", async () => {
    const { data, repos, ids } = seed();
    const otherOutletId = randomUUID();
    data.outlets.push({
      ...data.outlets[0],
      id: otherOutletId,
      name: "Other Garden",
      slug: "other-garden",
      service_charge_pct: 3,
    });
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "PATCH",
      url: "/api/admin/settings",
      cookies: staffCookie(data, "admin", ids.outlet),
      payload: { outletId: otherOutletId, service_charge_pct: 10 },
    });
    expect(res.statusCode).toBe(200);
    expect(data.outlets.find((o) => o.id === ids.outlet)?.service_charge_pct).toBe(10);
    expect(data.outlets.find((o) => o.id === otherOutletId)?.service_charge_pct).toBe(3);
  });
});
