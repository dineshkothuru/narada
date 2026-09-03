import { describe, expect, it } from "vitest";
import { tableQrUrl } from "../../src/lib/qr";

describe("tableQrUrl", () => {
  it("builds a /t/:code link off the given origin", () => {
    expect(tableQrUrl("https://narada.app", "table-3")).toBe("https://narada.app/t/table-3");
  });

  it("does not double up slashes when the origin has a trailing path", () => {
    expect(tableQrUrl("http://localhost:5173", "bar-1")).toBe("http://localhost:5173/t/bar-1");
  });
});
