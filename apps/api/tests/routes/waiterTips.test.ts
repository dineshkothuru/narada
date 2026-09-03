import { describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { seed } from "../helpers/fakeRepos.js";
import { staffHeader } from "../helpers/staffCookie.js";

describe("GET /api/waiter/tips", () => {
  it("200s for waiter and reports today's tips", async () => {
    const { data, repos } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({
      url: "/api/waiter/tips",
      headers: { cookie: staffHeader(data, "waiter") },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveProperty("since");
  });

  it("403s a role waiter excludes", async () => {
    const { data, repos } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({
      url: "/api/waiter/tips",
      headers: { cookie: staffHeader(data, "cashier") },
    });
    expect(res.statusCode).toBe(403);
  });
});
