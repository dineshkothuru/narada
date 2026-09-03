import { describe, expect, it } from "vitest";
import { outletSlugSchema, patchSettingsSchema } from "../src/schemas/adminSettings";

describe("outletSlugSchema", () => {
  it("trims and lowercases a valid slug", () => {
    expect(outletSlugSchema.parse("  Spice-Garden-7 ")).toBe("spice-garden-7");
  });

  it.each([
    "ab",
    "a".repeat(64),
    "-spice",
    "spice-",
    "spice--garden",
    "spice_garden",
    "Spice Garden",
  ])("rejects invalid slug %j", (slug) => {
    expect(outletSlugSchema.safeParse(slug).success).toBe(false);
  });

  it("normalizes the slug through the settings payload", () => {
    expect(patchSettingsSchema.parse({ slug: "  My-Outlet " }).slug).toBe("my-outlet");
  });
});
