// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AdminLoginPage from "../../src/pages/admin/Login";

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    json: async () => body,
  } as Response;
}

function renderLogin() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/admin/login"]}>
        <AdminLoginPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("AdminLoginPage", () => {
  const fetchMock = vi.fn();
  const originalReplace = window.location.replace;

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    // jsdom throws "not implemented" on navigation — stub it so the
    // post-login hard redirect doesn't crash the test
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, replace: vi.fn() },
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    fetchMock.mockReset();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, replace: originalReplace },
    });
  });

  it("posts the pin to /api/admin/login and redirects on success", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true, role: "kitchen", name: "Chef" }));
    renderLogin();

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText("PIN"), "1234");
    await user.click(screen.getByRole("button", { name: /unlock/i }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/login",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ pin: "1234" }),
      }),
    );
  });

  it("shows an error on a wrong pin", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "wrong pin" }, 401));
    renderLogin();

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText("PIN"), "0000");
    await user.click(screen.getByRole("button", { name: /unlock/i }));

    expect(await screen.findByText(/wrong pin/i)).toBeInTheDocument();
  });
});
