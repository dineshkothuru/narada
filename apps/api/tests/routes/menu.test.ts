import { describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { seed } from "../helpers/fakeRepos.js";

function appWithMenu() {
  const { repos } = seed();
  return buildApp({ repos });
}

describe("GET /api/menu", () => {
  it("400s when table is missing", async () => {
    const res = await appWithMenu().inject({ method: "GET", url: "/api/menu" });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "table required" });
  });

  it("404s for an unknown table code", async () => {
    const res = await appWithMenu().inject({
      method: "GET",
      url: "/api/menu?table=does-not-exist",
    });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: "unknown table" });
  });

  it("returns the customer menu for a known table", async () => {
    const res = await appWithMenu().inject({
      method: "GET",
      url: "/api/menu?table=t1-demo",
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      outlet: { name: "Spice Garden" },
      tableLabel: "Table 1",
      uiVariant: "classic",
    });
    expect(res.json().items).toHaveLength(3);
  });
});
