import { afterEach, describe, expect, it, vi } from "vitest";
import { askAnna, buildSystemPrompt } from "../../src/services/agent.js";
import { fetchMenu } from "../../src/services/menu.js";
import { seed } from "../helpers/fakeRepos.js";

afterEach(() => {
  vi.unstubAllGlobals();
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
  it("parses a successful OpenRouter reply", async () => {
    const { repos } = seed();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({ reply: "Namaste!", actions: [], uiLanguage: "en" }),
            },
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const menu = await fetchMenu(repos, "t1-demo");
    const result = await askAnna(menu!, [{ role: "user", text: "hi" }], [], "English");
    expect(result.reply).toBe("Namaste!");
    expect(result.actions).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://openrouter.ai/api/v1/chat/completions",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer test-openrouter-key" }),
        body: expect.stringContaining('"model":"google/gemini-3.1-flash-lite"'),
      }),
    );
  });

  it("does not retry a failed OpenRouter response", async () => {
    const { repos } = seed();
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 429 });
    vi.stubGlobal("fetch", fetchMock);

    const menu = await fetchMenu(repos, "t1-demo");
    await expect(askAnna(menu!, [{ role: "user", text: "hi" }], [], "English")).rejects.toThrow(
      "openrouter unavailable",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
