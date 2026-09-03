import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../../src/app.js";
import { clearApiKeyCache } from "../../src/services/keys.js";
import { seed } from "../helpers/fakeRepos.js";

afterEach(() => {
  vi.unstubAllGlobals();
  clearApiKeyCache();
});

describe("POST /api/anna", () => {
  it("returns Anna's parsed reply on a successful Gemini call", async () => {
    const { data, repos } = seed();
    data.outlets[0].gemini_api_key = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  { text: JSON.stringify({ reply: "Namaste!", actions: [], uiLanguage: "en" }) },
                ],
              },
            },
          ],
        }),
      }),
    );
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "POST",
      url: "/api/anna",
      payload: { messages: [{ role: "user", text: "hi" }], cart: [], tableCode: "t1-demo" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().reply).toBe("Namaste!");
  });

  it("400s when messages is missing", async () => {
    const { repos } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({ method: "POST", url: "/api/anna", payload: {} });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "messages required" });
  });

  it("400s with the legacy message when messages is malformed, not just empty", async () => {
    const { repos } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "POST",
      url: "/api/anna",
      payload: { messages: "not-an-array" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "messages required" });
  });

  it("502s when Gemini is unavailable", async () => {
    const { data, repos } = seed();
    data.outlets[0].gemini_api_key = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => "boom" }),
    );
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "POST",
      url: "/api/anna",
      payload: { messages: [{ role: "user", text: "hi" }], tableCode: "t1-demo" },
    });
    expect(res.statusCode).toBe(502);
    expect(res.json()).toEqual({ error: "Anna is unavailable right now" });
  });
});
