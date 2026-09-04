import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../../src/app.js";
import { CUSTOMER_COOKIE, customerCapability } from "../../src/lib/customerCapability.js";
import { seed } from "../helpers/fakeRepos.js";

afterEach(() => {
  vi.unstubAllGlobals();
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
      if (url.includes("openrouter.ai")) {
        return {
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {
                  content: JSON.stringify({ reply: "hi there", actions: [], uiLanguage: "en" }),
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
    const { repos } = seed();
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

  it("resolves an immediate takeaway turn from outletSlug before a session cookie exists", async () => {
    const { repos } = seed();
    stubFetch();
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "POST",
      url: "/api/voice",
      payload: { greet: true, outletSlug: "demo-spice-garden", cart: [], messages: [] },
    });
    expect(res.statusCode).toBe(200);
  });

  it("rejects an outletSlug that disagrees with the capability cookie", async () => {
    const { data, repos } = seed();
    data.outlets.push({ ...data.outlets[0], id: "outlet-two", slug: "other-outlet" });
    const session = await repos.sessions.create({
      outlet_id: data.outlets[0].id as string,
      table_id: null,
      service_type: "takeaway",
    });
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "POST",
      url: "/api/voice",
      headers: {
        cookie: `${CUSTOMER_COOKIE}=${customerCapability(session.id, data.outlets[0].id as string)}`,
      },
      payload: { greet: true, outletSlug: "other-outlet", cart: [], messages: [] },
    });
    expect(res.statusCode).toBe(403);
  });

  it("400s when audio, text and greet are all absent", async () => {
    const { repos } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "POST",
      url: "/api/voice",
      payload: { cart: [], messages: [] },
    });
    expect(res.statusCode).toBe(400);
  });

  it("reaches the service audio limit for a 4MB base64 payload", async () => {
    const { repos } = seed();
    const app = buildApp({ repos });
    const res = await app.inject({
      method: "POST",
      url: "/api/voice",
      payload: { audio: "a".repeat(4_000_001) },
    });
    expect(res.statusCode).toBe(413);
    expect(res.json()).toEqual({ error: "audio too long" });
  });
});
