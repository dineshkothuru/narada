import { describe, expect, it } from "vitest";
import {
  createCategory,
  deleteCategory,
  listAdminOrders,
  updateSettings,
} from "../../src/services/admin.js";
import { seed } from "../helpers/fakeRepos.js";

describe("createCategory", () => {
  it("creates a section appended after the highest sort_order", async () => {
    const { data, repos } = seed();
    const result = await createCategory(repos, { name: "Desserts" });
    expect(result.ok).toBe(true);
    const created = data.menu_categories.find((c) => c.id === result.id);
    expect(created?.sort_order).toBe(2);
    expect(created?.kind).toBe("food");
  });

  it("400s on an empty name", async () => {
    const { repos } = seed();
    await expect(createCategory(repos, { name: "   " })).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe("deleteCategory", () => {
  it("removes a section with no order history", async () => {
    const { data, repos, ids } = seed();
    const result = await deleteCategory(repos, ids.category);
    expect(result).toEqual({ ok: true });
    expect(data.menu_categories.find((c) => c.id === ids.category)).toBeUndefined();
  });

  it("hides items instead when the category has order history (FK failure)", async () => {
    const { data, repos, ids } = seed();
    data.order_items.push({
      id: "oi1",
      order_id: "o1",
      menu_item_id: ids.items[0],
      name: "Paneer Tikka",
      unit_price: 280,
      qty: 1,
      status: "queued",
    });
    // simulate the FK block by making remove throw for this category
    const original = repos.menuCategories.remove;
    repos.menuCategories.remove = async (id: string) => {
      if (id === ids.category) throw new Error("fk violation");
      return original(id);
    };

    const result = await deleteCategory(repos, ids.category);
    expect(result.ok).toBe(false);
    expect(
      data.menu_items.every((m) => m.category_id !== ids.category || m.is_available === false),
    ).toBe(true);
  });
});

describe("listAdminOrders", () => {
  it("computes gross, netExpected and topDishes from live orders", async () => {
    const { data, repos, ids } = seed();
    const session = {
      id: "s1",
      table_id: ids.tableA,
      outlet_id: ids.outlet,
      status: "active",
      created_at: new Date().toISOString(),
      discount_pct: 0,
      comp_awarded: false,
      guests: null,
      attendant: null,
      merged_into: null,
      service_waived: false,
      bill_no: null,
      settled_at: null,
    };
    data.sessions.push(session);
    data.orders.push({
      id: "o1",
      session_id: "s1",
      outlet_id: ids.outlet,
      status: "served",
      total_inr: 280,
      placed_via: "ui",
      created_at: new Date().toISOString(),
      placed_by: null,
    });
    data.order_items.push({
      id: "oi1",
      order_id: "o1",
      menu_item_id: ids.items[0],
      name: "Paneer Tikka",
      unit_price: 280,
      qty: 1,
      status: "served",
    });

    const result = await listAdminOrders(repos, "all");
    expect(result.stats.orders).toBe(1);
    expect(result.stats.gross).toBe(280);
    expect(result.stats.topDishes[0]).toEqual({ name: "Paneer Tikka", qty: 1 });
  });
});

describe("updateSettings", () => {
  it("applies only allow-listed fields", async () => {
    const { data, repos, ids } = seed();
    const result = await updateSettings(repos, {
      outletId: ids.outlet,
      service_charge_pct: 8,
      gstin: "  36ABCDE1234F1Z9  ",
      // @ts-expect-error unknown field should be dropped, not typed
      not_a_real_field: "x",
    });
    expect(result).toEqual({ ok: true });
    const outlet = data.outlets.find((o) => o.id === ids.outlet);
    expect(outlet?.service_charge_pct).toBe(8);
    expect(outlet?.gstin).toBe("36ABCDE1234F1Z9");
  });

  it("400s when nothing valid is set", async () => {
    const { repos, ids } = seed();
    await expect(
      updateSettings(repos, { outletId: ids.outlet, upi_vpa: "no-at-sign" }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("400s without an outletId", async () => {
    const { repos } = seed();
    await expect(updateSettings(repos, { outletId: "" })).rejects.toMatchObject({
      statusCode: 400,
    });
  });
});
