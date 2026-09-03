import { describe, expect, it, vi } from "vitest";
import {
  createCategory,
  deleteCategory,
  listAdminOrders,
  updateSettings,
} from "../../src/services/admin.js";
import { seed } from "../helpers/fakeRepos.js";

describe("createCategory", () => {
  it("creates a section appended after the highest sort_order", async () => {
    const { data, repos, ids } = seed();
    const result = await createCategory(repos, { name: "Desserts" }, ids.outlet);
    expect(result.ok).toBe(true);
    const created = data.menu_categories.find((c) => c.id === result.id);
    expect(created?.sort_order).toBe(2);
    expect(created?.kind).toBe("food");
  });

  it("400s on an empty name", async () => {
    const { repos, ids } = seed();
    await expect(createCategory(repos, { name: "   " }, ids.outlet)).rejects.toMatchObject({
      statusCode: 400,
    });
  });
});

describe("updateSettings outlet slug", () => {
  it("normalizes and stores a valid slug", async () => {
    const { data, repos, ids } = seed();
    await updateSettings(repos, { slug: "  New-Spice-Garden " }, ids.outlet);
    expect(data.outlets.find((outlet) => outlet.id === ids.outlet)?.slug).toBe("new-spice-garden");
  });

  it("rejects an invalid slug with 400", async () => {
    const { repos, ids } = seed();
    await expect(updateSettings(repos, { slug: "bad--slug" }, ids.outlet)).rejects.toMatchObject({
      statusCode: 400,
      message: "invalid outlet slug",
    });
  });

  it("maps a database uniqueness race to 409", async () => {
    const { repos, ids } = seed();
    const duplicate = Object.assign(new Error("duplicate key"), { code: "23505" });
    vi.spyOn(repos.outlets, "update").mockRejectedValue(duplicate);
    await expect(updateSettings(repos, { slug: "other-garden" }, ids.outlet)).rejects.toMatchObject(
      {
        statusCode: 409,
        message: "outlet slug already in use",
      },
    );
  });
});

describe("deleteCategory", () => {
  it("removes a section with no order history", async () => {
    const { data, repos, ids } = seed();
    const result = await deleteCategory(repos, ids.category, ids.outlet);
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
      return original(id, ids.outlet);
    };

    const result = await deleteCategory(repos, ids.category, ids.outlet);
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

    const result = await listAdminOrders(repos, "all", ids.outlet);
    expect(result.stats.orders).toBe(1);
    expect(result.stats.gross).toBe(280);
    expect(result.stats.topDishes[0]).toEqual({ name: "Paneer Tikka", qty: 1 });
  });
});

describe("updateSettings", () => {
  it("applies only allow-listed fields", async () => {
    const { data, repos, ids } = seed();
    const result = await updateSettings(
      repos,
      {
        outletId: ids.outlet,
        service_charge_pct: 8,
        gstin: "  36ABCDE1234F1Z9  ",
        // @ts-expect-error unknown field should be dropped, not typed
        not_a_real_field: "x",
      },
      ids.outlet,
    );
    expect(result).toEqual({ ok: true });
    const outlet = data.outlets.find((o) => o.id === ids.outlet);
    expect(outlet?.service_charge_pct).toBe(8);
    expect(outlet?.gstin).toBe("36ABCDE1234F1Z9");
  });

  it("400s when nothing valid is set", async () => {
    const { repos, ids } = seed();
    await expect(
      updateSettings(repos, { outletId: "other-outlet", upi_vpa: "no-at-sign" }, ids.outlet),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("uses the authenticated outlet instead of the body outletId", async () => {
    const { data, repos, ids } = seed();
    await expect(
      updateSettings(repos, { outletId: "other-outlet", gstin: "  GSTIN  " }, ids.outlet),
    ).resolves.toEqual({ ok: true });
    expect(data.outlets.find((o) => o.id === ids.outlet)?.gstin).toBe("GSTIN");
    expect(data.outlets.find((o) => o.id === "other-outlet")).toBeUndefined();
  });

  it("rejects an unknown authenticated outlet", async () => {
    const { repos } = seed();
    await expect(updateSettings(repos, { gstin: "GSTIN" }, "other-outlet")).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});
