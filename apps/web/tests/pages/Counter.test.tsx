// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import CounterPage from "../../src/pages/Counter";
import { useCounterAction } from "../../src/api/hooks/counter";
import { ask } from "../../src/components/Dialogs";
import { shareBillOnWhatsApp } from "../../src/components/TableSheet";

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
      if (url === "/api/admin/me") {
        return Promise.resolve(
          jsonResponse({
            role: "cashier",
            staffId: "s1",
            outletId: "o1",
            username: "meera",
            firstName: "Meera",
            lastName: "Cashier",
            displayName: "Meera Cashier",
          }),
        );
      }
      if (url === "/api/floor") return Promise.resolve(jsonResponse({ tables: [], stats: null }));
      if (url === "/api/counter") {
        return Promise.resolve(
          jsonResponse({
            tabs: [
              {
                sessionId: "s1",
                tableId: "t1",
                code: "table-5",
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

  it("sends payment data without a client-provided collector", async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/counter" && init?.method === "PATCH")
        return Promise.resolve(jsonResponse({ ok: true }));
      return Promise.resolve(jsonResponse({}, 404));
    });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <ActionProbe />
      </QueryClientProvider>,
    );
    await userEvent.setup().click(screen.getByRole("button", { name: "record payment" }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/counter",
        expect.objectContaining({ method: "PATCH" }),
      ),
    );
    const [, init] = fetchMock.mock.calls.find(
      ([url, req]) => url === "/api/counter" && (req as RequestInit)?.method === "PATCH",
    )! as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({
      action: "record_payment",
      sessionId: "s1",
      amount: 840,
      method: "cash",
    });
  });

  it("includes the table code in the counter detail bill link", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={["/counter"]}>
          <CounterPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await screen.findByText("Table 5");
    await userEvent.setup().click(screen.getByRole("button", { name: /details/i }));
    expect(screen.getByRole("link", { name: /print view/i })).toHaveAttribute(
      "href",
      "/bill/s1?tableCode=table-5",
    );
  });

  it("includes the table code in an unauthenticated bill link", async () => {
    const prompt = vi.spyOn(ask, "prompt").mockResolvedValue("");
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    await shareBillOnWhatsApp({
      sessionId: "s1",
      tableCode: "table 5/&",
      label: "Table 5",
      net: 840,
    });
    const whatsappUrl = new URL(String(open.mock.calls[0]?.[0]));
    expect(whatsappUrl.searchParams.get("text")).toContain("/bill/s1?tableCode=table%205%2F%26");
    prompt.mockRestore();
    open.mockRestore();
  });
});

function ActionProbe() {
  const action = useCounterAction();
  return (
    <button
      onClick={() =>
        action.mutate({ action: "record_payment", sessionId: "s1", amount: 840, method: "cash" })
      }
    >
      record payment
    </button>
  );
}
