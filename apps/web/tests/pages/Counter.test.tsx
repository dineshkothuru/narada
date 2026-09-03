// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import CounterPage from "../../src/pages/Counter";

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    json: async () => body,
  } as Response;
}

describe("CounterPage", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockImplementation((url: string) => {
      if (url === "/api/admin/me") return Promise.resolve(jsonResponse({ role: "cashier" }));
      if (url === "/api/floor") return Promise.resolve(jsonResponse({ tables: [], stats: null }));
      if (url === "/api/counter") {
        return Promise.resolve(
          jsonResponse({
            tabs: [
              {
                sessionId: "s1",
                tableId: "t1",
                label: "Table 5",
                mergedWith: [],
                since: new Date().toISOString(),
                attendant: "Meera",
                billNo: null,
                rounds: 2,
                unserved: 0,
                gross: 800,
                discount: 0,
                gst: 40,
                service: 0,
                serviceWaived: false,
                paid: 0,
                due: 840,
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

  it("fetches /api/counter and renders the tab awaiting a bill", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={["/counter"]}>
          <CounterPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText("Table 5")).toBeInTheDocument();
    expect(screen.getByText("Raise bill")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/counter",
      expect.objectContaining({ credentials: "include" }),
    );
  });
});
