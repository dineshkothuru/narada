// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import WaiterPage from "../../src/pages/Waiter";

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    json: async () => body,
  } as Response;
}

describe("WaiterPage", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockImplementation((url: string) => {
      if (url === "/api/admin/me") return Promise.resolve(jsonResponse({ role: "waiter" }));
      if (url === "/api/floor") return Promise.resolve(jsonResponse({ tables: [], stats: null }));
      if (url === "/api/waiter/tips") {
        return Promise.resolve(jsonResponse({ rows: [], unassigned: 0, total: 0 }));
      }
      if (url === "/api/waiter") {
        return Promise.resolve(
          jsonResponse({
            tables: [
              {
                tableId: "t1",
                label: "Table 3",
                code: "table-3",
                capacity: 4,
                call: null,
                needsCleaning: false,
                session: {
                  id: "s1",
                  since: new Date().toISOString(),
                  guests: 2,
                  status: "dining",
                  orders: [],
                  ordered: 500,
                  paid: 0,
                  attendant: "Ravi",
                  langs: ["en"],
                  billNo: null,
                  discountPct: 0,
                  gst: 25,
                  service: 0,
                  serviceWaived: false,
                  due: 525,
                },
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

  it("fetches /api/waiter and renders the open table", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={["/waiter"]}>
          <WaiterPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText("Table 3")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/waiter",
      expect.objectContaining({ credentials: "include" }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/waiter/tips",
      expect.objectContaining({ credentials: "include" }),
    );
  });
});
