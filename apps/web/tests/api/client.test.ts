import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../../src/api/client";

describe("api client", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("does not send a JSON content type for bodyless DELETE requests", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await api("/auth/staff/logout", { method: "DELETE" });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("DELETE");
    expect(new Headers(init.headers).has("Content-Type")).toBe(false);
  });

  it("adds JSON content type only for non-empty bodies and preserves caller headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await api("/auth/staff/login", {
      method: "POST",
      headers: { Authorization: "Bearer test" },
      body: JSON.stringify({ password: "correct-horse-battery" }),
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.get("Authorization")).toBe("Bearer test");
    expect(headers.get("Content-Type")).toBe("application/json");
  });
});
