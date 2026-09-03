// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AdminUsersPage from "../../../src/pages/admin/Users";

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    json: async () => body,
  } as Response;
}

describe("AdminUsersPage", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockImplementation((url: string) => {
      if (url === "/api/admin/me") return Promise.resolve(jsonResponse({ role: "admin" }));
      if (url === "/api/floor") return Promise.resolve(jsonResponse({ tables: [] }));
      if (url === "/api/admin/staff") {
        return Promise.resolve(
          jsonResponse({
            staff: [
              {
                id: "s1",
                username: "maya",
                firstName: "Maya",
                lastName: "Patel",
                displayName: "Maya",
                role: "waiter",
                active: true,
                needsSetup: false,
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

  it("shows display name, username, and setup state without credentials", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={["/admin/users"]}>
          <AdminUsersPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /staff & logins/i }));
    expect(await screen.findByText("Maya")).toBeInTheDocument();
    expect(screen.getByText("@maya")).toBeInTheDocument();
    expect(screen.getByText("Ready")).toBeInTheDocument();
    expect(screen.queryByText("secret")).not.toBeInTheDocument();
  });

  it("uses Unicode-safe password length constraints for staff creation", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={["/admin/users"]}>
          <AdminUsersPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /staff & logins/i }));
    fireEvent.click(await screen.findByRole("button", { name: /add staff/i }));
    const password = screen.getByPlaceholderText("Password (15–128 characters)");
    expect(password).toHaveAttribute("minlength", "15");
    expect(password).not.toHaveAttribute("maxlength");
  });

  it("renders legacy setup rows without undefined identity labels", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === "/api/admin/me") return Promise.resolve(jsonResponse({ role: "admin" }));
      if (url === "/api/floor") return Promise.resolve(jsonResponse({ tables: [] }));
      if (url === "/api/admin/staff") {
        return Promise.resolve(
          jsonResponse({
            staff: [
              {
                id: "legacy",
                username: null,
                firstName: null,
                lastName: null,
                displayName: null,
                role: "waiter",
                active: true,
                needsSetup: true,
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
        <MemoryRouter initialEntries={["/admin/users"]}>
          <AdminUsersPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: /staff & logins/i }));
    expect(await screen.findAllByText("Setup required")).toHaveLength(2);
    expect(screen.getByRole("button", { name: /complete setup/i })).toBeInTheDocument();
    expect(screen.queryByText("@undefined")).not.toBeInTheDocument();
  });

  it("enrolls a setup row with a required new password", async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/admin/me") return Promise.resolve(jsonResponse({ role: "admin" }));
      if (url === "/api/floor") return Promise.resolve(jsonResponse({ tables: [] }));
      if (url === "/api/admin/staff" && init?.method === "PATCH") {
        return Promise.resolve(jsonResponse({ ok: true }));
      }
      if (url === "/api/admin/staff") {
        return Promise.resolve(
          jsonResponse({
            staff: [
              {
                id: "legacy",
                username: null,
                firstName: null,
                lastName: null,
                displayName: null,
                name: null,
                role: "waiter",
                active: true,
                needsSetup: true,
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
        <MemoryRouter initialEntries={["/admin/users"]}>
          <AdminUsersPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: /staff & logins/i }));
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /complete setup/i }));
    const password = screen.getByPlaceholderText("Password (15–128 characters)");
    expect(password).toBeRequired();
    await user.type(screen.getByPlaceholderText("username"), "Maya.Server");
    await user.type(screen.getByPlaceholderText("First name"), "Maya");
    await user.type(password, "correct-horse-battery");
    const completeSetupButtons = screen.getAllByRole("button", { name: /complete setup/i });
    await user.click(completeSetupButtons.at(-1)!);
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/staff",
        expect.objectContaining({ method: "PATCH" }),
      ),
    );
    const [, init] = fetchMock.mock.calls.find(
      ([url, req]) => url === "/api/admin/staff" && (req as RequestInit)?.method === "PATCH",
    )! as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({
      staffId: "legacy",
      username: "maya.server",
      firstName: "Maya",
      lastName: null,
      password: "correct-horse-battery",
    });
  });

  it("creates an account with canonical username and names", async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/admin/me") return Promise.resolve(jsonResponse({ role: "admin" }));
      if (url === "/api/floor") return Promise.resolve(jsonResponse({ tables: [] }));
      if (url === "/api/admin/staff" && init?.method === "POST")
        return Promise.resolve(jsonResponse({ ok: true }));
      if (url === "/api/admin/staff") return Promise.resolve(jsonResponse({ staff: [] }));
      return Promise.resolve(jsonResponse({}, 404));
    });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={["/admin/users"]}>
          <AdminUsersPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: /staff & logins/i }));
    fireEvent.click(await screen.findByRole("button", { name: /add staff/i }));
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText("username"), "Maya.Server");
    await user.type(screen.getByPlaceholderText("First name"), "Maya");
    await user.type(screen.getByPlaceholderText("Last name (optional)"), "Patel");
    await user.type(
      screen.getByPlaceholderText("Password (15–128 characters)"),
      "correct-horse-battery",
    );
    await user.click(screen.getByRole("button", { name: /^add$/i }));
    const call = fetchMock.mock.calls.find(
      ([url, init]) => url === "/api/admin/staff" && (init as RequestInit)?.method === "POST",
    );
    expect(call).toBeTruthy();
    expect(JSON.parse(String((call![1] as RequestInit).body))).toEqual({
      username: "maya.server",
      firstName: "Maya",
      lastName: "Patel",
      role: "waiter",
      password: "correct-horse-battery",
    });
  });

  it("edits identity fields and only sends a password when provided", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={["/admin/users"]}>
          <AdminUsersPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: /staff & logins/i }));
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /^edit$/i }));
    const firstName = screen.getByDisplayValue("Maya");
    fireEvent.change(firstName, { target: { value: "Maya Rose" } });
    fireEvent.change(screen.getByDisplayValue("Patel"), { target: { value: "" } });
    await user.click(screen.getByRole("button", { name: /^save$/i }));
    const call = fetchMock.mock.calls.find(
      ([url, init]) => url === "/api/admin/staff" && (init as RequestInit)?.method === "PATCH",
    );
    expect(call).toBeTruthy();
    expect(JSON.parse(String((call![1] as RequestInit).body))).toEqual({
      staffId: "s1",
      username: "maya",
      firstName: "Maya Rose",
      lastName: null,
    });
  });
});
