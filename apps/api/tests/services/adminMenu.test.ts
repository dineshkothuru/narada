import { describe, expect, it } from "vitest";
import {
  createMenuItem,
  deleteMenuItem,
  getAdminMenu,
  patchMenuItem,
} from "../../src/services/adminMenu.js";
import { seed } from "../helpers/fakeRepos.js";

describe("getAdminMenu", () => {
  it("returns the outlet slug for admin navigation", async () => {
    const { repos, ids } = seed();
    const result = await getAdminMenu(repos, ids.outlet);
    expect(result.outlet).toMatchObject({ id: ids.outlet, slug: "demo-spice-garden" });
  });
});

describe("createMenuItem", () => {
  it("creates a dish under its category's outlet", async () => {
    const { data, repos, ids } = seed();
    const result = await createMenuItem(
      repos,
      {
        category_id: ids.category,
        name: "Chilli Paneer",
        price_inr: 260,
      },
      ids.outlet,
    );
    expect(result.ok).toBe(true);
    const item = data.menu_items.find((m) => m.id === result.id);
    expect(item?.outlet_id).toBe(ids.outlet);
    expect(item?.is_veg).toBe(true);
  });

  it("400s on a non-positive price", async () => {
    const { repos, ids } = seed();
    await expect(
      createMenuItem(repos, { category_id: ids.category, name: "X", price_inr: 0 }, ids.outlet),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("404s on an unknown category", async () => {
    const { repos, ids } = seed();
    await expect(
      createMenuItem(
        repos,
        {
          category_id: "00000000-0000-0000-0000-000000000000",
          name: "X",
          price_inr: 10,
        },
        ids.outlet,
      ),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("deleteMenuItem", () => {
  it("removes a dish with no order history", async () => {
    const { data, repos, ids } = seed();
    const result = await deleteMenuItem(repos, ids.items[0], ids.outlet);
    expect(result).toEqual({ ok: true });
    expect(data.menu_items.find((m) => m.id === ids.items[0])).toBeUndefined();
  });

  it("hides a dish instead when it has order history", async () => {
    const { data, repos, ids } = seed();
    const original = repos.menuItems.remove;
    repos.menuItems.remove = async (id: string) => {
      if (id === ids.items[0]) throw new Error("fk violation");
      return original(id, ids.outlet);
    };
    const result = await deleteMenuItem(repos, ids.items[0], ids.outlet);
    expect(result.ok).toBe(false);
    expect(data.menu_items.find((m) => m.id === ids.items[0])?.is_available).toBe(false);
  });

  it("400s without an itemId", async () => {
    const { repos, ids } = seed();
    await expect(deleteMenuItem(repos, "", ids.outlet)).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe("patchMenuItem", () => {
  it("applies only recognised fields, filtering tags to the allow-list", async () => {
    const { data, repos, ids } = seed();
    const result = await patchMenuItem(
      repos,
      {
        itemId: ids.items[0],
        is_available: false,
        tags: ["bestseller", "not-a-real-tag"],
        gst_pct: 12,
      },
      ids.outlet,
    );
    expect(result).toEqual({ ok: true });
    const item = data.menu_items.find((m) => m.id === ids.items[0]);
    expect(item?.is_available).toBe(false);
    expect(item?.tags).toEqual(["bestseller"]);
    expect(item?.gst_pct).toBe(12);
  });

  it("400s without an itemId", async () => {
    const { repos, ids } = seed();
    await expect(
      patchMenuItem(repos, { itemId: "", is_available: true }, ids.outlet),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("400s when there is nothing valid to update", async () => {
    const { repos, ids } = seed();
    await expect(patchMenuItem(repos, { itemId: ids.items[0] }, ids.outlet)).rejects.toMatchObject({
      statusCode: 400,
    });
  });
});
