import { afterEach, describe, expect, it, vi } from "vitest";
import { clearDishImage, uploadDishImage } from "../../src/services/storage.js";
import { seed } from "../helpers/fakeRepos.js";

describe("dish images", () => {
  const originalFetch = globalThis.fetch;

  // src/env.ts snapshots process.env at import time, so these come from the
  // `env` block in vitest.config.ts rather than being set here
  const SUPABASE_URL = "http://localhost.test";

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const png = (over: Partial<Parameters<typeof uploadDishImage>[1]> = {}) => ({
    itemId: "",
    contentType: "image/png",
    size: 1024,
    body: Buffer.from("not-really-a-png"),
    ...over,
  });

  it("rejects a file type the menu cannot show", async () => {
    const { repos, ids } = seed();
    await expect(
      uploadDishImage(
        repos,
        png({ itemId: ids.items[0], contentType: "application/pdf" }),
        ids.outlet,
      ),
    ).rejects.toMatchObject({ statusCode: 415 });
  });

  it("rejects an image over 4MB", async () => {
    const { repos, ids } = seed();
    await expect(
      uploadDishImage(repos, png({ itemId: ids.items[0], size: 5 * 1024 * 1024 }), ids.outlet),
    ).rejects.toMatchObject({ statusCode: 413 });
  });

  it("404s a dish that does not exist", async () => {
    const { repos, ids } = seed();
    await expect(
      uploadDishImage(repos, png({ itemId: "00000000-0000-0000-0000-000000000000" }), ids.outlet),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("400s without an itemId", async () => {
    const { repos, ids } = seed();
    await expect(uploadDishImage(repos, png(), ids.outlet)).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("uploads to the bucket and writes the public URL onto the dish", async () => {
    const { data, repos, ids } = seed();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => "" });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await uploadDishImage(repos, png({ itemId: ids.items[0] }), ids.outlet);

    expect(result.imageUrl).toMatch(
      new RegExp(`^${SUPABASE_URL}/storage/v1/object/public/menu/${ids.items[0]}/\\d+\\.png$`),
    );
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/storage/v1/object/menu/");
    expect(init.headers.apikey).toBeTruthy();
    expect(init.headers["x-upsert"]).toBe("true");

    const item = data.menu_items.find((m) => m.id === ids.items[0]);
    expect(item?.image_url).toBe(result.imageUrl);
  });

  it("surfaces a failed upload as a 502 and leaves the dish alone", async () => {
    const { data, repos, ids } = seed();
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 500, text: async () => "boom" }) as never;

    await expect(
      uploadDishImage(repos, png({ itemId: ids.items[0] }), ids.outlet),
    ).rejects.toMatchObject({ statusCode: 502 });
    expect(data.menu_items.find((m) => m.id === ids.items[0])?.image_url).toBeNull();
  });

  it("clears a photo so the dish falls back to its emoji", async () => {
    const { data, repos, ids } = seed();
    const item = data.menu_items.find((m) => m.id === ids.items[0]);
    item!.image_url = `${SUPABASE_URL}/old.png`;

    expect(await clearDishImage(repos, ids.items[0], ids.outlet)).toEqual({ ok: true });
    expect(item?.image_url).toBeNull();
  });
});
