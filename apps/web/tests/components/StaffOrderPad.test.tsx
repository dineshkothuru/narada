// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import StaffOrderPad from "../../src/components/StaffOrderPad";

const menu = {
  tableLabel: "Table 1",
  categories: [{ id: "food", name: "Food", emoji: "🍽️" }],
  items: [
    {
      id: "paneer",
      categoryId: "food",
      name: "Paneer Tikka",
      priceInr: 220,
      isVeg: true,
      isAvailable: true,
      emoji: "🍢",
    },
    {
      id: "biryani",
      categoryId: "food",
      name: "Veg Biryani",
      priceInr: 260,
      isVeg: true,
      isAvailable: true,
      emoji: "🍚",
    },
  ],
};

describe("StaffOrderPad", () => {
  it("filters the menu by search text", async () => {
    const user = userEvent.setup();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <StaffOrderPad
          outletSlug="narada"
          tableCode="table-1"
          sessionId="s1"
          menu={menu}
          onPlaced={() => undefined}
        />
      </QueryClientProvider>,
    );

    expect(screen.getByText(/Paneer Tikka/)).toBeInTheDocument();
    expect(screen.getByText(/Veg Biryani/)).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText("Search the menu…"), "paneer");
    expect(screen.getByText(/Paneer Tikka/)).toBeInTheDocument();
    expect(screen.queryByText(/Veg Biryani/)).not.toBeInTheDocument();
  });
});
