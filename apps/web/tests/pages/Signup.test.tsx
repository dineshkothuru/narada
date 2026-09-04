// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import StaffSignupPage from "../../src/pages/admin/Signup";

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    json: async () => body,
  } as Response;
}

describe("StaffSignupPage", () => {
  const fetchMock = vi.fn();

  beforeEach(() => vi.stubGlobal("fetch", fetchMock));
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("uses the route's fixed role when creating staff", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <StaffSignupPage role="waiter" />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const user = userEvent.setup();
    const password = screen.getByPlaceholderText("Password (15–128 characters)");
    expect(password).toHaveAttribute("type", "password");
    expect(password).toHaveAttribute("autocomplete", "new-password");
    expect(password).toHaveAttribute("minlength", "15");
    expect(password).not.toHaveAttribute("maxlength");
    await user.type(screen.getByPlaceholderText("username"), "Maya.Server");
    await user.type(screen.getByPlaceholderText("First name"), "Maya");
    await user.type(screen.getByPlaceholderText("Last name"), "Patel");
    await user.type(password, "a-secure-password-123");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    const [path, init] = fetchMock.mock.calls.at(-1)! as [string, RequestInit];
    expect(path).toBe("/api/admin/staff");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      username: "maya.server",
      firstName: "Maya",
      lastName: "Patel",
      role: "waiter",
      password: "a-secure-password-123",
    });
    expect(screen.getByRole("alert")).toHaveTextContent(/account created/i);
  });

  it("announces password validation errors and marks the field invalid", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <StaffSignupPage role="waiter" />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const user = userEvent.setup();
    const password = screen.getByPlaceholderText("Password (15–128 characters)");
    await user.type(screen.getByPlaceholderText("username"), "maya.server");
    await user.type(screen.getByPlaceholderText("First name"), "Maya");
    await user.type(password, "short");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(password).toHaveAttribute("aria-invalid", "true");
    expect(password.closest('[data-slot="field"]')).toHaveAttribute("data-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent(/password must be/i);
  });
});
