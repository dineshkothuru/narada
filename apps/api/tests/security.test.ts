import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";

describe("API security defaults", () => {
  it("adds Helmet headers and generated request IDs", async () => {
    const app = buildApp();
    const first = await app.inject({ url: "/health" });
    const second = await app.inject({ url: "/health" });

    expect(first.headers["x-content-type-options"]).toBe("nosniff");
    expect(first.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(second.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(first.headers["x-request-id"]).not.toBe(second.headers["x-request-id"]);
  });

  it("does not trust an inbound request ID", async () => {
    const app = buildApp();
    const response = await app.inject({
      url: "/health",
      headers: { "x-request-id": "attacker-controlled" },
    });

    expect(response.headers["x-request-id"]).not.toBe("attacker-controlled");
  });

  it("keeps opted-in routes rate limited", async () => {
    const app = buildApp();
    const responses = await Promise.all(
      Array.from({ length: 11 }, () =>
        app.inject({ method: "POST", url: "/api/outlet/demo-spice-garden/login", payload: {} }),
      ),
    );

    expect(responses.at(-1)?.statusCode).toBe(429);
  });

  it("does not let spoofed forwarded IPs bypass limits without proxy trust", async () => {
    const app = buildApp();
    const responses = await Promise.all(
      Array.from({ length: 11 }, (_, index) =>
        app.inject({
          method: "POST",
          url: "/api/outlet/demo-spice-garden/login",
          headers: { "x-forwarded-for": `2001:db8::${index + 1}` },
          payload: {},
        }),
      ),
    );

    expect(responses.at(-1)?.statusCode).toBe(429);
  });
});
