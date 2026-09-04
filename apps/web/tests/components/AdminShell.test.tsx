// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AdminShell from "../../src/components/AdminShell";

function response(body: unknown) {
  return { ok: true, status: 200, statusText: "OK", json: async () => body } as Response;
}

describe("AdminShell", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockImplementation((url: string) => {
      if (url === "/api/admin/me") return Promise.resolve(response({ role: "kitchen" }));
      return Promise.resolve(response({ tables: [] }));
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("filters navigation by role and marks the active route", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={["/kitchen"]}>
          <AdminShell>
            <p>Kitchen screen</p>
          </AdminShell>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const kitchen = await screen.findAllByRole("link", { name: /kitchen/i });
    expect(kitchen[0]).toHaveAttribute("href", "/kitchen");
    expect(kitchen[0].className).toContain("bg-indigo-50");
    await waitFor(() => {
      expect(screen.queryByRole("link", { name: /floor/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: /settings/i })).not.toBeInTheDocument();
    });
    expect(screen.getByText("Kitchen screen")).toBeInTheDocument();
  });
});
