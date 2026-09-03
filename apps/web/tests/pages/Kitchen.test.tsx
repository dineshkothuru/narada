// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import KitchenPage from "../../src/pages/Kitchen";

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    json: async () => body,
  } as Response;
}

describe("KitchenPage", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockImplementation((url: string) => {
      if (url === "/api/admin/me") return Promise.resolve(jsonResponse({ role: "kitchen" }));
      if (url === "/api/floor") return Promise.resolve(jsonResponse({ tables: [], stats: null }));
      if (url === "/api/kitchen") {
        return Promise.resolve(
          jsonResponse({
            orders: [
              {
                id: "o1",
                status: "placed",
                total_inr: 250,
                placed_via: "ui",
                lang: "en",
                created_at: new Date().toISOString(),
                session: { table: { label: "Table 3" } },
                items: [{ id: "i1", name: "Masala Dosa", qty: 1, notes: null, status: "queued" }],
              },
            ],
          }),
        );
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

  it("fetches /api/kitchen and renders the ticket", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={["/kitchen"]}>
          <KitchenPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText("Table 3")).toBeInTheDocument();
    expect(screen.getByText(/Masala Dosa/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/kitchen",
      expect.objectContaining({ credentials: "include" }),
    );
  });
});
