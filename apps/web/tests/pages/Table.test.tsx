// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

const STORIES_MENU = { ...MENU, uiVariant: "stories" as const };
let currentMenu = MENU;

function renderTable(menu = MENU) {
  currentMenu = menu;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/outlet/spice-garden/table/t1-demo"]}>
        <Routes>
          <Route path="/outlet/:slug/table/:tableCode" element={<TablePage />} />
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
      if (url.startsWith("/api/outlet/spice-garden/menu")) {
        return Promise.resolve(jsonResponse(currentMenu));
      }
      if (url.startsWith("/api/outlet/spice-garden/table/t1-demo/session")) {
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
    currentMenu = MENU;
  });

  it("loads the menu for the :code in the URL and renders the outlet and dishes", async () => {
    renderTable();

    expect(await screen.findByText("Spice Garden")).toBeInTheDocument();
    expect(screen.getByText("Dine-in")).toBeInTheDocument();
    expect(screen.queryByText("Table 1 · Dine-in")).not.toBeInTheDocument();
    expect(screen.getAllByText("Masala Dosa").length).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/outlet/spice-garden/menu?tableCode=t1-demo",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("asks whether the table already has a live session", async () => {
    renderTable();

    await screen.findByText("Spice Garden");
    await vi.waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/outlet/spice-garden/table/t1-demo/session",
        expect.objectContaining({ credentials: "include" }),
      ),
    );
  });

  it("shows a recoverable message when the table is unknown", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse({ error: "unknown" }, 404)));
    renderTable();

    expect(await screen.findByText("We could not load this table.")).toBeInTheDocument();
  });

  it("shows the KOT immediately after placing an order", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.startsWith("/api/outlet/spice-garden/menu"))
        return Promise.resolve(jsonResponse(MENU));
      if (url.startsWith("/api/outlet/spice-garden/table/t1-demo/session"))
        return Promise.resolve(jsonResponse({ sessionId: null }));
      if (url === "/api/order") {
        return Promise.resolve(
          jsonResponse({
            orderId: "11111111-1111-4111-8111-111111111111",
            orderNo: "11111111",
            total: 120,
            discountPct: 0,
            sessionId: "session-1",
          }),
        );
      }
      if (url.startsWith("/api/bill?session=session-1")) {
        return Promise.resolve(
          jsonResponse({
            ...{
              billNo: null,
              lines: [],
              gross: 120,
              discountPct: 0,
              discount: 0,
              gst: 0,
              serviceChargePct: 0,
              serviceWaived: false,
              service: 0,
              tip: 0,
              net: 120,
              paid: 0,
              rounds: [],
            },
          }),
        );
      }
      return Promise.resolve(jsonResponse({}, 404));
    });

    const user = userEvent.setup();
    renderTable();
    await user.click((await screen.findAllByRole("button", { name: /add/i }))[0]);
    await user.click(screen.getByRole("button", { name: /View cart/ }));
    await user.click(screen.getByRole("button", { name: /Place order/ }));

    expect((await screen.findAllByText("KOT #11111111")).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole("link", { name: /View \/ print bill/ })).toHaveAttribute(
      "href",
      "/bill/session-1",
    );
  });

  it("restores the visible order banner from a resumed session", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.startsWith("/api/outlet/spice-garden/menu"))
        return Promise.resolve(jsonResponse(MENU));
      if (url.startsWith("/api/outlet/spice-garden/table/t1-demo/session"))
        return Promise.resolve(jsonResponse({ sessionId: "session-1" }));
      if (url === "/api/order?session=session-1")
        return Promise.resolve(
          jsonResponse({
            rounds: [
              {
                id: "11111111-1111-4111-8111-111111111111",
                orderNo: "11111111",
                status: "preparing",
                total_inr: 120,
                items: [{ name: "Masala Dosa", qty: 1, status: "preparing" }],
              },
            ],
            discountPct: 0,
            sessionStatus: "active",
          }),
        );
      return Promise.resolve(jsonResponse({}, 404));
    });

    renderTable();
    expect(await screen.findByText("KOT #11111111")).toBeInTheDocument();
  });

  it("renders the outlet-scoped table in Stories mode", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.startsWith("/api/outlet/spice-garden/menu"))
        return Promise.resolve(jsonResponse(STORIES_MENU));
      if (url.startsWith("/api/outlet/spice-garden/table/t1-demo/session"))
        return Promise.resolve(jsonResponse({ sessionId: "session-1" }));
      if (url.startsWith("/api/order?session=")) {
        return Promise.resolve(
          jsonResponse({
            rounds: [
              {
                id: "11111111-1111-4111-8111-111111111111",
                orderNo: "11111111",
                status: "placed",
                total_inr: 120,
                items: [{ name: "Masala Dosa", qty: 1, status: "queued" }],
              },
            ],
            discountPct: 0,
            sessionStatus: "active",
          }),
        );
      }
      return Promise.resolve(jsonResponse({}, 404));
    });

    renderTable(STORIES_MENU);

    expect(await screen.findByText("✨ Stories")).toBeInTheDocument();
  });
});
