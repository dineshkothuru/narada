// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import OutletLoginPage from "../../src/pages/admin/Login";
import { safeNext } from "../../src/lib/roles";

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    json: async () => body,
  } as Response;
}

function renderLogin(next = "/kitchen") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter
        initialEntries={[`/outlet/spice-garden/login?next=${encodeURIComponent(next)}`]}
      >
        <Routes>
          <Route path="/outlet/:slug/login" element={<OutletLoginPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("OutletLoginPage", () => {
  const fetchMock = vi.fn();
  const originalReplace = window.location.replace;

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(jsonResponse({}, 404));
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

  it("only preserves same-origin destinations allowed for the signed-in role", () => {
    expect(safeNext("/kitchen?tab=open", "kitchen")).toBe("/kitchen?tab=open");
    expect(safeNext("/admin", "kitchen")).toBeNull();
    expect(safeNext("/kitchen/signup", "kitchen")).toBeNull();
    expect(safeNext("/outlet/spice-garden/login", "admin")).toBeNull();
    expect(safeNext("https://evil.example/", "admin")).toBeNull();
  });

  it("uses the server-derived role for the safe destination", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === "/api/outlet/spice-garden/login") {
        return Promise.resolve(
          jsonResponse({
            ok: true,
            role: "kitchen",
            staff: { id: "s1", username: "chef", firstName: "Chef", displayName: "Chef" },
            outlet: { id: "o1", name: "Spice Garden", slug: "spice-garden" },
          }),
        );
      }
      return Promise.resolve(jsonResponse({}, 404));
    });
    renderLogin("/kitchen");
    const user = userEvent.setup();
    await user.type(await screen.findByPlaceholderText("username"), "chef");
    await user.type(screen.getByPlaceholderText("Password"), "correct-horse-battery");
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    expect(window.location.replace).toHaveBeenCalledWith("/kitchen");
  });

  it("uses the outlet slug endpoint without sending an outlet id", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === "/api/outlet/spice-garden/login") {
        return Promise.resolve(
          jsonResponse({
            ok: true,
            role: "admin",
            staff: { id: "s1", username: "owner", firstName: "Owner", displayName: "Owner" },
            outlet: { id: "o1", name: "Spice Garden", slug: "spice-garden" },
          }),
        );
      }
      return Promise.resolve(jsonResponse({}, 404));
    });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={["/outlet/spice-garden/login?next=/admin"]}>
          <Routes>
            <Route path="/outlet/:slug/login" element={<OutletLoginPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const user = userEvent.setup();
    await user.type(await screen.findByPlaceholderText("username"), "owner");
    await user.type(screen.getByPlaceholderText("Password"), "correct-horse-battery");
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByText(/outlet/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    const call = fetchMock.mock.calls.find(([url]) => url === "/api/outlet/spice-garden/login");
    expect(call).toBeDefined();
    const [, init] = call as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({
      username: "owner",
      password: "correct-horse-battery",
    });
    expect(String(init.body)).not.toContain("outletId");
  });

  it("does not require outlet discovery for an outlet-scoped login", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === "/api/outlet/spice-garden/login") {
        return Promise.resolve(
          jsonResponse({
            ok: true,
            role: "admin",
            staff: { id: "s1", username: "owner", firstName: "Owner", displayName: "Owner" },
            outlet: { id: "o1", name: "Spice Garden", slug: "spice-garden" },
          }),
        );
      }
      return Promise.resolve(jsonResponse({}, 404));
    });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={["/outlet/spice-garden/login?next=/admin"]}>
          <Routes>
            <Route path="/outlet/:slug/login" element={<OutletLoginPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const user = userEvent.setup();
    await user.type(await screen.findByPlaceholderText("username"), "owner");
    await user.type(screen.getByPlaceholderText("Password"), "correct-horse-battery");
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/outlet/spice-garden/login",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("shows an error on wrong credentials", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === "/api/outlet/spice-garden/login")
        return Promise.resolve(jsonResponse({ error: "invalid credentials" }, 401));
      return Promise.resolve(jsonResponse({}, 404));
    });
    renderLogin();
    const user = userEvent.setup();
    await user.type(await screen.findByPlaceholderText("username"), "unknown");
    await user.type(screen.getByPlaceholderText("Password"), "wrong-password!");
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    expect(await screen.findByText(/invalid username or password/i)).toBeInTheDocument();
  });

  it("announces username validation errors and marks the field invalid", async () => {
    renderLogin();
    const user = userEvent.setup();
    const username = await screen.findByPlaceholderText("username");
    await user.type(username, "!");
    await user.type(screen.getByPlaceholderText("Password"), "correct-horse-battery");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(username).toHaveAttribute("aria-invalid", "true");
    expect(username.closest('[data-slot="field"]')).toHaveAttribute("data-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent(/username must be/i);
  });
});
