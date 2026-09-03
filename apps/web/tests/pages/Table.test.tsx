// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import TablePage from "../../src/pages/Table";

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    json: async () => body,
  } as Response;
}

const MENU = {
  outlet: {
    name: "Spice Garden",
    tagline: "Authentic Indian kitchen",
    upiVpa: "demo@upi",
    paymentTiming: "post",
  },
  tableLabel: "Table 1",
  uiVariant: "classic",
  categories: [{ id: "mains", name: { en: "Main Course", hi: "", te: "" }, emoji: "🍛" }],
  items: [
    {
      id: "dosa",
      categoryId: "mains",
      name: { en: "Masala Dosa", hi: "", te: "" },
      description: { en: "Crisp rice crepe", hi: "", te: "" },
      priceInr: 120,
      isVeg: true,
      spiceLevel: 1,
      allergens: [],
      tags: ["bestseller"],
      emoji: "🍛",
      imageUrl: null,
      isAvailable: true,
    },
  ],
};

function renderTable() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/t/t1-demo"]}>
        <Routes>
          <Route path="/t/:code" element={<TablePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("TablePage", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    // jsdom has no scrollIntoView, and the order experience calls it
    Element.prototype.scrollIntoView = vi.fn();
    fetchMock.mockImplementation((url: string) => {
      if (url.startsWith("/api/menu")) return Promise.resolve(jsonResponse(MENU));
      if (url.startsWith("/api/session")) {
        return Promise.resolve(jsonResponse({ sessionId: null }));
      }
      return Promise.resolve(jsonResponse({}, 404));
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("loads the menu for the :code in the URL and renders the outlet and dishes", async () => {
    renderTable();

    expect(await screen.findByText("Spice Garden")).toBeInTheDocument();
    expect(screen.getByText("Table 1 · Dine-in")).toBeInTheDocument();
    expect(screen.getAllByText("Masala Dosa").length).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/menu?table=t1-demo",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("asks whether the table already has a live session", async () => {
    renderTable();

    await screen.findByText("Spice Garden");
    await vi.waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/session?table=t1-demo",
        expect.objectContaining({ credentials: "include" }),
      ),
    );
  });

  it("shows a recoverable message when the table is unknown", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse({ error: "unknown" }, 404)));
    renderTable();

    expect(await screen.findByText("We could not load this table.")).toBeInTheDocument();
  });
});
