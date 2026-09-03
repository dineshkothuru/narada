// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import CustomerLoginPage from "../../src/pages/CustomerLogin";
import CustomerSignupPage from "../../src/pages/CustomerSignup";
import { safeCustomerNext } from "../../src/lib/customerAuth";

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    json: async () => body,
  } as Response;
}

function renderPage(page: React.ReactNode, entry = "/login") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[entry]}>{page}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("customer auth", () => {
  const fetchMock = vi.fn();

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("keeps redirects same-origin", () => {
    expect(safeCustomerNext("/outlet/spice-garden?next=1")).toBe("/outlet/spice-garden?next=1");
    expect(safeCustomerNext("https://evil.example/")).toBe("/");
    expect(safeCustomerNext("//evil.example/")).toBe("/");
    expect(safeCustomerNext("/login")).toBe("/");
  });

  it("posts a canonical phone and password on sign in", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        ok: true,
        customer: { id: "c1", phone: "+919876543210", firstName: "Asha", displayName: "Asha" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    renderPage(<CustomerLoginPage />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/phone number/i), "+91 (98765)-43210");
    await user.type(screen.getByLabelText(/password/i), "correct-horse-battery");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/customer/login",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ phone: "+919876543210", password: "correct-horse-battery" }),
      }),
    );
  });

  it("requires a first name and sends an optional last name on signup", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        ok: true,
        customer: {
          id: "c1",
          phone: "+919876543210",
          firstName: "Asha",
          lastName: "Rao",
          displayName: "Asha Rao",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    renderPage(<CustomerSignupPage />, "/signup");
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/phone number/i), "+91 (98765)-43210");
    await user.type(screen.getByLabelText(/first name/i), "Asha");
    await user.type(screen.getByLabelText(/last name/i), "Rao");
    await user.type(screen.getByLabelText(/password/i), "correct-horse-battery");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/customer/signup",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          phone: "+919876543210",
          firstName: "Asha",
          lastName: "Rao",
          password: "correct-horse-battery",
        }),
      }),
    );
  });
});
