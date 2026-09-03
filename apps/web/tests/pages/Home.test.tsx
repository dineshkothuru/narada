// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import Home from "../../src/pages/Home";

describe("Home", () => {
  it("links demo tables to the seeded table codes", () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: /Table 1/ })).toHaveAttribute(
      "href",
      "/outlet/demo-spice-garden/table/t1-demo",
    );
    expect(screen.getByRole("link", { name: /Table 2/ })).toHaveAttribute(
      "href",
      "/outlet/demo-spice-garden/table/t2-demo",
    );
    expect(screen.getByRole("link", { name: /Table 3/ })).toHaveAttribute(
      "href",
      "/outlet/demo-spice-garden/table/t3-demo",
    );
    expect(screen.getByRole("link", { name: /Table 4/ })).toHaveAttribute(
      "href",
      "/outlet/demo-spice-garden/table/t4-demo",
    );
  });
});
