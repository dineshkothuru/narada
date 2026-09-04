// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation, useNavigationType } from "react-router";
import App from "../src/App";

vi.mock("../src/pages/CustomerLogin", () => ({
  default: () => <p>Customer login screen</p>,
}));

function LocationProbe() {
  return (
    <>
      <output data-testid="path">{useLocation().pathname}</output>
      <output data-testid="navigation-type">{useNavigationType()}</output>
    </>
  );
}

describe("App routes", () => {
  it("redirects the root to customer login without adding a history entry", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
        <LocationProbe />
      </MemoryRouter>,
    );

    expect(screen.getByText("Customer login screen")).toBeInTheDocument();
    expect(screen.getByTestId("path")).toHaveTextContent("/login");
    expect(screen.getByTestId("navigation-type")).toHaveTextContent("REPLACE");
  });
});
