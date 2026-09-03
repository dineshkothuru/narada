// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import FloorPage from "../../src/pages/Floor";

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    json: async () => body,
  } as Response;
}

describe("FloorPage", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/admin/me") {
        return Promise.resolve(jsonResponse({ role: "reception", displayName: "Alice Server" }));
      }
      if (url === "/api/floor" && init?.method === "PATCH") {
        return Promise.resolve(jsonResponse({ ok: true }));
      }
      if (url === "/api/floor") {
        return Promise.resolve(
          jsonResponse({
            tables: [
              {
                id: "t1",
                label: "Table 1",
                code: "table-1",
                capacity: 4,
                zone: null,
                status: "dining",
                billNo: null,
                sessionId: "s1",
                isMerged: false,
                mergedWith: [],
                since: new Date().toISOString(),
                guests: 2,
                rounds: 1,
                served: 1,
                pending: 0,
                due: 0,
                attendant: null,
                langs: [],
                calling: false,
                callId: null,
                callSince: null,
              },
            ],
            stats: null,
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

  it("keeps the floor surface host-only", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={["/floor"]}>
          <FloorPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText("Table 1")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /assign alice server/i })).not.toBeInTheDocument();
    expect(screen.queryByText("Menu")).not.toBeInTheDocument();
    expect(screen.queryByText("Bill")).not.toBeInTheDocument();
  });
});
