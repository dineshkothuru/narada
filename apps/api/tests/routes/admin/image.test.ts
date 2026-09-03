import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../../../src/app.js";
import { ADMIN_COOKIE, roleToken } from "../../../src/plugins/auth.js";
import { seed } from "../../helpers/fakeRepos.js";

// Builds a minimal valid multipart/form-data body without a browser.
function multipartBody(
  boundary: string,
  itemId: string,
  opts: { contentType: string; bytes: Buffer },
) {
  const parts = [
    `--${boundary}\r\n`,
    `Content-Disposition: form-data; name="itemId"\r\n\r\n${itemId}\r\n`,
    `--${boundary}\r\n`,
    `Content-Disposition: form-data; name="file"; filename="dish.bin"\r\n`,
    `Content-Type: ${opts.contentType}\r\n\r\n`,
  ]
    .join("")
    .replace(/\n/g, "\r\n")
    .replace(/\r\r\n/g, "\r\n");
  const head = Buffer.from(parts, "utf8");
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`, "utf8");
  return Buffer.concat([head, opts.bytes, tail]);
}

describe("POST /api/admin/image", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("uploads an image and writes the URL onto the dish", async () => {
    const { data, repos, ids } = seed();
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 200, text: async () => "" }) as never;

    const app = buildApp({ repos });
    const boundary = "----adminImageTest";
    const body = multipartBody(boundary, ids.items[0], {
      contentType: "image/png",
      bytes: Buffer.from("fake-png-bytes"),
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/admin/image",
      cookies: { [ADMIN_COOKIE]: await roleToken("admin") },
      headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
      payload: body,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);
    const item = data.menu_items.find((m) => m.id === ids.items[0]);
    expect(item?.image_url).toBeTruthy();
  });

  it("415s on an unsupported content type", async () => {
    const { repos, ids } = seed();
    const app = buildApp({ repos });
    const boundary = "----adminImageTest2";
    const body = multipartBody(boundary, ids.items[0], {
      contentType: "application/pdf",
      bytes: Buffer.from("not an image"),
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/admin/image",
      cookies: { [ADMIN_COOKIE]: await roleToken("admin") },
      headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
      payload: body,
    });

    expect(res.statusCode).toBe(415);
  });

  it("413s on an oversize file", async () => {
    const { repos, ids } = seed();
    const app = buildApp({ repos });
    const boundary = "----adminImageTest3";
    const body = multipartBody(boundary, ids.items[0], {
      contentType: "image/png",
      bytes: Buffer.alloc(5 * 1024 * 1024, 1),
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/admin/image",
      cookies: { [ADMIN_COOKIE]: await roleToken("admin") },
      headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
      payload: body,
    });

    expect(res.statusCode).toBe(413);
  });
});

describe("DELETE /api/admin/image", () => {
  it("clears a dish's photo", async () => {
    const { data, repos, ids } = seed();
    const item = data.menu_items.find((m) => m.id === ids.items[0]);
    item!.image_url = "https://example.test/old.png";

    const app = buildApp({ repos });
    const res = await app.inject({
      method: "DELETE",
      url: `/api/admin/image?itemId=${ids.items[0]}`,
      cookies: { [ADMIN_COOKIE]: await roleToken("admin") },
    });

    expect(res.statusCode).toBe(200);
    expect(item?.image_url).toBeNull();
  });

  it("400s without itemId", async () => {
    const { repos } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "DELETE",
      url: "/api/admin/image",
      cookies: { [ADMIN_COOKIE]: await roleToken("admin") },
    });
    expect(res.statusCode).toBe(400);
  });
});
