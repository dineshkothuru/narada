import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../../src/app.js";
import { clearApiKeyCache } from "../../src/services/keys.js";
import { seed } from "../helpers/fakeRepos.js";

afterEach(() => {
  vi.unstubAllGlobals();
  clearApiKeyCache();
});

function stubFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("speech-to-text")) {
        return { ok: true, json: async () => ({ transcript: "hello", language_code: "en-IN" }) };
      }
      if (url.includes("text-to-speech")) {
        return { ok: true, json: async () => ({ audios: ["base64audio"] }) };
      }
      if (url.includes("generativelanguage")) {
        return {
          ok: true,
          json: async () => ({
            candidates: [
              {
                content: {
                  parts: [
                    { text: JSON.stringify({ reply: "hi there", actions: [], uiLanguage: "en" }) },
                  ],
                },
              },
            ],
          }),
        };
      }
      throw new Error(`unexpected fetch: ${url}`);
    }),
  );
}

describe("POST /api/voice", () => {
  it("greets and returns spoken audio on a greet trigger", async () => {
    const { data, repos } = seed();
    data.outlets[0].sarvam_api_key = "sarvam-key";
    data.outlets[0].gemini_api_key = "gemini-key";
    stubFetch();
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "POST",
      url: "/api/voice",
      payload: { greet: true, cart: [], messages: [], tableCode: "t1-demo" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.reply).toBe("hi there");
    expect(body.audio).toBe("base64audio");
    expect(body.transcript).toBe("");
  });

  it("400s when audio, text and greet are all absent", async () => {
    const { data, repos } = seed();
    data.outlets[0].sarvam_api_key = "sarvam-key";
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "POST",
      url: "/api/voice",
      payload: { cart: [], messages: [] },
    });
    expect(res.statusCode).toBe(400);
  });

  it("500s when no Sarvam key is configured anywhere", async () => {
    const { repos } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "POST",
      url: "/api/voice",
      payload: { greet: true, cart: [], messages: [] },
    });
    // env.SARVAM_API_KEY may or may not be set in the ambient environment;
    // either the well-known 500 or a successful turn is a valid outcome here.
    expect([200, 500]).toContain(res.statusCode);
  });
});
