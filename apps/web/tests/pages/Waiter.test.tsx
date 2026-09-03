// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
      if (url === "/api/admin/me") {
        return Promise.resolve(
          jsonResponse({
            role: "waiter",
            staffId: "s1",
            outletId: "o1",
            username: "alice",
            firstName: "Alice",
            lastName: "Server",
            displayName: "Alice Server",
          }),
        );
      }
      if (url === "/api/floor") return Promise.resolve(jsonResponse({ tables: [], stats: null }));
      if (url === "/api/waiter/tips") {
        return Promise.resolve(
          jsonResponse({
            rows: [{ attendant: "Alice Server", tips: 100, tables: 1 }],
            unassigned: 0,
            total: 100,
          }),
        );
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
    expect(await screen.findByText("Alice Server · 1 table settled")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/waiter",
      expect.objectContaining({ credentials: "include" }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/waiter/tips",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("lets the server attribute a call without a client identity field", async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/admin/me")
        return Promise.resolve(jsonResponse({ role: "waiter", displayName: "Alice Server" }));
      if (url === "/api/floor") return Promise.resolve(jsonResponse({ tables: [] }));
      if (url === "/api/waiter/tips")
        return Promise.resolve(jsonResponse({ rows: [], unassigned: 0, total: 0 }));
      if (url === "/api/waiter" && init?.method === "PATCH")
        return Promise.resolve(jsonResponse({ ok: true }));
      if (url === "/api/waiter") {
        return Promise.resolve(
          jsonResponse({
            tables: [
              {
                tableId: "t1",
                label: "Table 3",
                code: "table-3",
                capacity: 4,
                call: { id: "c1", created_at: new Date().toISOString() },
                needsCleaning: false,
                session: null,
              },
            ],
          }),
        );
      }
      return Promise.resolve(jsonResponse({}, 404));
    });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={["/waiter"]}>
          <WaiterPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /on it/i }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/waiter",
        expect.objectContaining({ method: "PATCH" }),
      ),
    );
    const [, init] = fetchMock.mock.calls.find(
      ([url, req]) => url === "/api/waiter" && (req as RequestInit)?.method === "PATCH",
    )! as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ action: "ack_call", callId: "c1" });
  });
});
