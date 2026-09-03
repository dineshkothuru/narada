import { describe, expect, it, vi } from "vitest";
import { claimComp, spin } from "../../src/services/reward.js";
import { seed } from "../helpers/fakeRepos.js";

describe("spin", () => {
  it("rejects an unknown table", async () => {
    const { repos } = seed();
    await expect(spin(repos, "nope")).rejects.toMatchObject({
      statusCode: 404,
      message: "unknown table",
    });
  });

  it("returns the already-won discount without re-rolling once a session has one", async () => {
    const { data, repos } = seed();
    const table = data.tables.find((t) => t.code === "t1-demo")!;
    data.sessions.push({
      id: "s1",
      table_id: table.id,
      outlet_id: table.outlet_id,
      status: "active",
      created_at: new Date().toISOString(),
      closed_at: null,
      discount_pct: 10,
      comp_awarded: false,
      guests: null,
      attendant: null,
      merged_into: null,
      service_waived: false,
      bill_no: null,
      bill_tip: null,
      tip_to: null,
      settled_at: null,
    });

    const result = await spin(repos, "t1-demo");
    expect(result).toEqual({ ok: false, discountPct: 10, sliceIndex: 2 });
  });

  it("claims a fresh discount atomically when the wheel lands on one", async () => {
    const { data, repos } = seed();
    vi.spyOn(Math, "random").mockReturnValue(0); // first slice: 5% discount
    const result = await spin(repos, "t1-demo");
    expect(result).toEqual({ ok: true, discountPct: 5, sliceIndex: 0 });
    expect(data.sessions[0].discount_pct).toBe(5);
    vi.restoreAllMocks();
  });

  it("does not mutate a billed session", async () => {
    const { data, repos } = seed();
    const table = data.tables.find((t) => t.code === "t1-demo")!;
    data.sessions.push({
      id: "billed-session",
      table_id: table.id,
      outlet_id: table.outlet_id,
      status: "active",
      created_at: new Date().toISOString(),
      closed_at: null,
      discount_pct: 0,
      comp_awarded: false,
      guests: null,
      attendant: null,
      merged_into: null,
      service_waived: false,
      bill_no: "NAR-20260101-0001",
      bill_tip: null,
      tip_to: null,
      settled_at: null,
    });
    await expect(claimComp(repos, "t1-demo")).rejects.toMatchObject({ statusCode: 409 });
    expect(data.sessions.find((s) => s.id === "billed-session")?.comp_awarded).toBe(false);
    expect(data.orders).toHaveLength(0);
  });
});

describe("claimComp", () => {
  it("rejects with a domain 400 when the session has no orders yet", async () => {
    const { repos } = seed();
    const result = await claimComp(repos, "t1-demo");
    expect(result).toEqual({ ok: false, reason: "no orders yet" });
  });

  it("awards the fallback comp item once an order exists", async () => {
    const { data, repos, ids } = seed();
    const table = data.tables.find((t) => t.code === "t1-demo")!;
    data.sessions.push({
      id: "s1",
      table_id: table.id,
      outlet_id: table.outlet_id,
      status: "active",
      created_at: new Date().toISOString(),
      closed_at: null,
      discount_pct: 0,
      comp_awarded: false,
      guests: null,
      attendant: null,
      merged_into: null,
      service_waived: false,
      bill_no: null,
      bill_tip: null,
      tip_to: null,
      settled_at: null,
    });
    data.orders.push({
      id: "o1",
      session_id: "s1",
      outlet_id: table.outlet_id,
      status: "served",
      total_inr: 100,
      placed_via: "ui",
      created_at: new Date().toISOString(),
      placed_by: null,
      lang: null,
    });

    const result = await claimComp(repos, "t1-demo");
    expect(result).toEqual({ ok: true, item: "Gulab Jamun (2 pcs)" });
    expect(data.sessions[0].comp_awarded).toBe(true);
    expect(data.orders).toHaveLength(2);
    const compItem = data.order_items.find((it) => it.notes?.toString().includes("Complimentary"));
    expect(compItem?.unit_price).toBe(0);
    expect(ids.items).toBeDefined();
  });

  it("refuses a second claim once the comp flag is already set", async () => {
    const { data, repos } = seed();
    const table = data.tables.find((t) => t.code === "t1-demo")!;
    data.sessions.push({
      id: "s1",
      table_id: table.id,
      outlet_id: table.outlet_id,
      status: "active",
      created_at: new Date().toISOString(),
      closed_at: null,
      discount_pct: 0,
      comp_awarded: true,
      guests: null,
      attendant: null,
      merged_into: null,
      service_waived: false,
      bill_no: null,
      bill_tip: null,
      tip_to: null,
      settled_at: null,
    });
    data.orders.push({
      id: "o1",
      session_id: "s1",
      outlet_id: table.outlet_id,
      status: "served",
      total_inr: 100,
      placed_via: "ui",
      created_at: new Date().toISOString(),
      placed_by: null,
      lang: null,
    });

    const result = await claimComp(repos, "t1-demo");
    expect(result).toEqual({ ok: false, reason: "already awarded" });
  });

  it("claims the comp against the primary when the table session is merged", async () => {
    const { data, repos, ids } = seed();
    const primary = await repos.sessions.create({ table_id: ids.tableB, outlet_id: ids.outlet });
    const child = await repos.sessions.create({ table_id: ids.tableA, outlet_id: ids.outlet });
    await repos.sessions.update(child.id, { merged_into: primary.id }, ids.outlet);
    data.orders.push({
      id: "merged-order",
      session_id: child.id,
      outlet_id: ids.outlet,
      status: "served",
      total_inr: 100,
      placed_via: "ui",
      created_at: new Date().toISOString(),
      placed_by: null,
      lang: null,
    });

    const result = await claimComp(repos, "t1-demo");
    expect(result).toEqual({ ok: true, item: "Gulab Jamun (2 pcs)" });
    expect(data.sessions.find((session) => session.id === primary.id)?.comp_awarded).toBe(true);
    expect(data.orders.at(-1)?.session_id).toBe(primary.id);
  });
});
