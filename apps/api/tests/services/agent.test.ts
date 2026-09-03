import { afterEach, describe, expect, it, vi } from "vitest";
import { askAnna, buildSystemPrompt } from "../../src/services/agent.js";
import { clearApiKeyCache } from "../../src/services/keys.js";
import { fetchMenu } from "../../src/services/menu.js";
import { seed } from "../helpers/fakeRepos.js";

afterEach(() => {
  vi.unstubAllGlobals();
  clearApiKeyCache();
});

describe("buildSystemPrompt", () => {
  it("includes the full menu and marks sold-out items", async () => {
    const { data, repos } = seed();
    data.menu_items[0].is_available = false;
    const menu = await fetchMenu(repos, "t1-demo");
    const prompt = buildSystemPrompt(menu!, [], "English");

    expect(prompt).toContain("Paneer Tikka");
    expect(prompt).toContain("Veg Manchurian");
    expect(prompt).toContain("Gulab Jamun (2 pcs)");
    expect(prompt).toContain("SOLD_OUT_TODAY");
    expect(prompt).toContain("Spice Garden");
  });
});

describe("askAnna", () => {
  // env.GEMINI_API_KEY is snapshotted once at process start (src/env.ts), so
  // a "no key anywhere" case can't be forced from a test without mutating
  // that frozen singleton; the fallback path is exercised instead by
  // services/speech.test.ts, which triggers it through a failing fetch.

  it("parses a successful Gemini reply", async () => {
    const { data, repos } = seed();
    data.outlets[0].gemini_api_key = "test-key";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    reply: "Namaste!",
                    actions: [],
                    uiLanguage: "en",
                  }),
                },
              ],
            },
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const menu = await fetchMenu(repos, "t1-demo");
    const result = await askAnna(repos, menu!, [{ role: "user", text: "hi" }], [], "English");
    expect(result.reply).toBe("Namaste!");
    expect(result.actions).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls back from flash to flash-lite on a 429", async () => {
    const { data, repos } = seed();
    data.outlets[0].gemini_api_key = "test-key";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 429, text: async () => "rate limited" })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [
            { content: { parts: [{ text: JSON.stringify({ reply: "hi", actions: [] }) }] } },
          ],
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const menu = await fetchMenu(repos, "t1-demo");
    const result = await askAnna(repos, menu!, [{ role: "user", text: "hi" }], [], "English");
    expect(result.reply).toBe("hi");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
