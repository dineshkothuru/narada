import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { makeDeps } from "../src/deps.js";
import { seed } from "./helpers/fakeRepos.js";

describe("makeDeps", () => {
  it("uses a repos override instead of constructing real repos", () => {
    const { repos } = seed();
    // db is never touched: makeDeps must not attempt to open a Postgres pool
    // when a repos override is present.
    const deps = makeDeps(undefined as never, { repos });
    expect(deps.repos).toBe(repos);
    expect(deps.clock()).toBeInstanceOf(Date);
  });
});

describe("buildApp deps decoration", () => {
  it("exposes app.deps.repos as the same instance as app.repos", () => {
    const { repos } = seed();
    const app = buildApp({ deps: { repos } });
    expect(app.deps.repos).toBe(repos);
    expect(app.repos).toBe(app.deps.repos);
  });
});
