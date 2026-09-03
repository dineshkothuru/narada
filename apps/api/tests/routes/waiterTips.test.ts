import { describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { ADMIN_COOKIE, roleToken } from "../../src/plugins/auth.js";
import { seed } from "../helpers/fakeRepos.js";

const cookieFor = async (role: "kitchen" | "waiter" | "admin" | "cashier" | "reception") =>
  `${ADMIN_COOKIE}=${await roleToken(role)}`;

describe("GET /api/waiter/tips", () => {
  it("200s for waiter and reports today's tips", async () => {
    const { repos } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({
      url: "/api/waiter/tips",
      headers: { cookie: await cookieFor("waiter") },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveProperty("since");
  });

  it("403s a role waiter excludes", async () => {
    const { repos } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({
      url: "/api/waiter/tips",
      headers: { cookie: await cookieFor("cashier") },
    });
    expect(res.statusCode).toBe(403);
  });
});
