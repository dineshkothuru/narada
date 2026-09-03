// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AdminTablesPage from "../../../src/pages/admin/Tables";

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    json: async () => body,
  } as Response;
}

describe("AdminTablesPage", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockImplementation((url: string) => {
      if (url === "/api/admin/me") return Promise.resolve(jsonResponse({ role: "admin" }));
      if (url === "/api/floor") return Promise.resolve(jsonResponse({ tables: [], stats: null }));
      if (url === "/api/admin/tables") {
        return Promise.resolve(
          jsonResponse({
            tables: [
              { id: "t1", label: "Table 1", code: "table-1", ui_variant: "classic", capacity: 4 },
            ],
            outletName: "Narada",
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

  it("fetches /api/admin/tables and renders the table row", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={["/admin/tables"]}>
          <AdminTablesPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    // the "Tables" section starts collapsed — open it to see the row.
    // "Tables" also appears in the page heading, so target the section's own
    // toggle button by its aria-expanded state.
    const toggles = await screen.findAllByText("Tables");
    const toggle = toggles.find((el) => el.closest("button[aria-expanded]"));
    fireEvent.click(toggle!.closest("button")!);
    expect(await screen.findByDisplayValue("Table 1")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/tables",
      expect.objectContaining({ credentials: "include" }),
    );
  });
});
