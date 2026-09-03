import { describe, expect, it } from "vitest";
import { tableQrUrl } from "../../src/lib/qr";

describe("tableQrUrl", () => {
  it("builds an outlet-scoped table link", () => {
    expect(tableQrUrl("https://narada.app", "spice-garden", "table-3")).toBe(
      "https://narada.app/outlet/spice-garden/table/table-3",
    );
  });

  it("encodes outlet and table segments", () => {
    expect(tableQrUrl("http://localhost:5173/", "spice garden", "bar/1")).toBe(
      "http://localhost:5173/outlet/spice%20garden/table/bar%2F1",
    );
  });
});
