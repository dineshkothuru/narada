// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AdminDashboardPage from "../../../src/pages/admin/Dashboard";

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    json: async () => body,
  } as Response;
}

describe("AdminDashboardPage", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation((url: string) => {
      if (url === "/api/admin/me") {
        return Promise.resolve(
          jsonResponse({
            role: "admin",
            staffId: "s1",
            outletId: "o1",
            username: "owner",
            firstName: "Owner",
            displayName: "Owner",
          }),
        );
      }
      if (url === "/api/floor") return Promise.resolve(jsonResponse({ tables: [] }));
      if (url === "/api/admin/menu") {
        return Promise.resolve(
          jsonResponse({
            categories: [],
            items: [],
            outlet: {
              id: "o1",
              name: "Spice Garden",
              slug: "spice-garden",
              upi_vpa: null,
              payment_timing: "post",
              gemini_api_key: null,
              sarvam_api_key: null,
              comp_item_id: null,
              service_charge_pct: 0,
              gstin: null,
            },
          }),
        );
      }
      if (url === "/api/admin/settings") {
        return Promise.resolve(jsonResponse({ error: "outlet slug already in use" }, 409));
      }
      return Promise.resolve(jsonResponse({}, 404));
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("normalizes the slug, previews the public URL, and surfaces duplicate errors", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <AdminDashboardPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /^Settings/ }));
    const slug = await screen.findByLabelText("Outlet URL slug");
    await user.clear(slug);
    await user.type(slug, "Taken-Slug");
    expect(slug).toHaveValue("taken-slug");
    expect(screen.getByText("Public URL: /outlet/taken-slug")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save URL" }));
    expect(await screen.findByText("That outlet URL is already in use")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/settings",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ slug: "taken-slug" }),
      }),
    );
  });
});
