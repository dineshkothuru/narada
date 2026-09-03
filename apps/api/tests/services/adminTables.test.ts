import { describe, expect, it } from "vitest";
import { createTables, deleteTable, patchTable } from "../../src/services/adminTables.js";
import { seed } from "../helpers/fakeRepos.js";

describe("createTables", () => {
  it("creates a batch of tables with generated unique codes, continuing numbering", async () => {
    const { data, repos, ids } = seed();
    const result = await createTables(repos, { count: 2, prefix: "Table" }, ids.outlet);
    expect(result).toEqual({ ok: true, added: 2 });
    const labels = data.tables.map((t) => t.label);
    expect(labels).toContain("Table 3");
    expect(labels).toContain("Table 4");
    const codes = new Set(data.tables.map((t) => t.code));
    expect(codes.size).toBe(data.tables.length);
  });

  it("creates a single labelled table", async () => {
    const { data, repos, ids } = seed();
    const result = await createTables(repos, { label: "Patio 1" }, ids.outlet);
    expect(result).toEqual({ ok: true, added: 1 });
    expect(data.tables.some((t) => t.label === "Patio 1")).toBe(true);
  });

  it("400s without label or count", async () => {
    const { repos, ids } = seed();
    await expect(createTables(repos, {}, ids.outlet)).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe("patchTable", () => {
  it("updates recognised fields only", async () => {
    const { data, repos, ids } = seed();
    const result = await patchTable(
      repos,
      {
        tableId: ids.tableA,
        capacity: 6,
        ui_variant: "stories",
      },
      ids.outlet,
    );
    expect(result).toEqual({ ok: true });
    const table = data.tables.find((t) => t.id === ids.tableA);
    expect(table?.capacity).toBe(6);
    expect(table?.ui_variant).toBe("stories");
  });

  it("400s without a tableId", async () => {
    const { repos, ids } = seed();
    await expect(patchTable(repos, { tableId: "" }, ids.outlet)).rejects.toMatchObject({
      statusCode: 400,
    });
  });
});

describe("deleteTable", () => {
  it("blocks deleting a table with an open tab", async () => {
    const { data, repos, ids } = seed();
    data.sessions.push({
      id: "s1",
      table_id: ids.tableA,
      outlet_id: ids.outlet,
      status: "active",
      created_at: new Date().toISOString(),
      discount_pct: 0,
      comp_awarded: false,
    });
    await expect(deleteTable(repos, ids.tableA, ids.outlet)).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it("removes a table with no active session and no order history", async () => {
    const { data, repos, ids } = seed();
    const result = await deleteTable(repos, ids.tableB, ids.outlet);
    expect(result).toEqual({ ok: true });
    expect(data.tables.find((t) => t.id === ids.tableB)).toBeUndefined();
  });
});
