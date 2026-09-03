// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AdminMenuPage from "../../../src/pages/admin/Menu";

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    json: async () => body,
  } as Response;
}

const menuBody = {
  categories: [{ id: "c1", name: "Starters", emoji: "🥗", kind: "food" }],
  items: [
    {
      id: "i1",
      category_id: "c1",
      name: "Paneer Tikka",
      description: null,
      price_inr: 220,
      is_veg: true,
      is_available: true,
      tags: [],
      spice_level: 1,
      allergens: [],
      gst_pct: 5,
      image_url: null,
      emoji: "🍽️",
    },
  ],
  outlet: null,
};

describe("AdminMenuPage", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockImplementation((url: string) => {
      if (url === "/api/admin/me") return Promise.resolve(jsonResponse({ role: "admin" }));
      if (url === "/api/floor") return Promise.resolve(jsonResponse({ tables: [], stats: null }));
      if (url === "/api/admin/menu") return Promise.resolve(jsonResponse(menuBody));
      if (url === "/api/admin/image") {
        return Promise.resolve(jsonResponse({ ok: true, imageUrl: "https://x/img.jpg" }));
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

  function renderPage() {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={["/admin/menu"]}>
          <AdminMenuPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
  }

  it("fetches /api/admin/menu and renders the dish", async () => {
    renderPage();
    // sections start collapsed — open "Starters" to see its dishes
    fireEvent.click(await screen.findByText(/Starters/));
    expect(await screen.findByText("Paneer Tikka")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/menu",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("uploads a dish photo as multipart FormData to /api/admin/image", async () => {
    renderPage();
    fireEvent.click(await screen.findByText(/Starters/));
    await screen.findByText("Paneer Tikka");

    // open the edit panel, then find the hidden file input
    fireEvent.click(screen.getByTitle("Edit details"));
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();

    const file = new File(["fake"], "dish.jpg", { type: "image/jpeg" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/image",
        expect.objectContaining({
          method: "POST",
          credentials: "include",
          body: expect.any(FormData),
        }),
      ),
    );
    const call = fetchMock.mock.calls.find(([url]) => url === "/api/admin/image");
    const body = call![1].body as FormData;
    expect(body.get("itemId")).toBe("i1");
    expect(body.get("file")).toBe(file);
  });
});
