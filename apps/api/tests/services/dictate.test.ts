import { afterEach, describe, expect, it, vi } from "vitest";
import { dictateOrder } from "../../src/services/dictate.js";
import { seed } from "../helpers/fakeRepos.js";

afterEach(() => vi.unstubAllGlobals());

describe("dictateOrder", () => {
  it("matches an order with one OpenRouter request", async () => {
    const { repos, ids } = seed();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          { message: { content: JSON.stringify({ lines: [{ itemId: ids.items[0], qty: 2 }] }) } },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      dictateOrder(repos, { tableCode: "t1-demo", text: "two paneer tikka" }, ids.outlet),
    ).resolves.toMatchObject({ lines: [{ itemId: ids.items[0], qty: 2 }] });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://openrouter.ai/api/v1/chat/completions",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer test-openrouter-key" }),
        body: expect.stringContaining(
          '"provider":{"allow_fallbacks":false,"require_parameters":true}',
        ),
      }),
    );
  });
});
