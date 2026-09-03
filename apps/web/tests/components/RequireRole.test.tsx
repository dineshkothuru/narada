// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import RequireRole from "../../src/components/RequireRole";

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    json: async () => body,
  } as Response;
}

function renderAt(
  path: string,
  roles?: ("admin" | "kitchen" | "waiter" | "reception" | "cashier")[],
) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            path="/kitchen"
            element={
              <RequireRole roles={roles}>
                <p>Kitchen screen</p>
              </RequireRole>
            }
          />
          <Route path="/" element={<p>Home screen</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("RequireRole", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("redirects home on a 401 (logged out)", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ role: null }, 401));
    renderAt("/kitchen", ["admin", "kitchen"]);
    await waitFor(() => expect(screen.getByText("Home screen")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/me",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("redirects home when the role isn't allowed for this route", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ role: "waiter" }));
    renderAt("/kitchen", ["admin", "kitchen"]);
    await waitFor(() => expect(screen.getByText("Home screen")).toBeInTheDocument());
  });

  it("renders the child when the role is allowed", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ role: "kitchen" }));
    renderAt("/kitchen", ["admin", "kitchen"]);
    await waitFor(() => expect(screen.getByText("Kitchen screen")).toBeInTheDocument());
  });
});
