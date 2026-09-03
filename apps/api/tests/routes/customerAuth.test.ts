import { describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { CUSTOMER_ACCOUNT_COOKIE } from "../../src/lib/customerAuth.js";
import { seed } from "../helpers/fakeRepos.js";

const cookieValue = (res: { headers: Record<string, unknown> }) => {
  const raw = res.headers["set-cookie"];
  const first = Array.isArray(raw) ? raw[0] : raw;
  return (
    String(first ?? "")
      .split(";", 1)[0]
      .split("=", 2)[1] ?? ""
  );
};

describe("customer phone auth", () => {
  it("normalizes phone, allows an omitted last name, and attaches identity to a new visit", async () => {
    const { data, repos } = seed();
    const app = buildApp({ repos });
    const signup = await app.inject({
      method: "POST",
      url: "/api/auth/customer/signup",
      payload: {
        phone: "+91 (98765)-43210",
        firstName: "  Priya ",
        password: "customer-test-password",
      },
    });
    expect(signup.statusCode).toBe(200);
    expect(signup.json().customer).toMatchObject({
      phone: "+919876543210",
      firstName: "Priya",
      lastName: null,
    });
    const accountCookie = cookieValue(signup);
    expect(signup.headers["set-cookie"]).toContain(`${CUSTOMER_ACCOUNT_COOKIE}=`);

    const visit = await app.inject({
      method: "POST",
      url: "/api/outlet/demo-spice-garden/session",
      cookies: { [CUSTOMER_ACCOUNT_COOKIE]: accountCookie },
      payload: {},
    });
    expect(visit.statusCode).toBe(200);
    expect(data.sessions[0]?.customer_id).toBe(signup.json().customer.id);
  });

  it("logs in and revalidates the active account for me", async () => {
    const { repos } = seed();
    const app = buildApp({ repos });
    await app.inject({
      method: "POST",
      url: "/api/auth/customer/signup",
      payload: {
        phone: "+919876543210",
        firstName: "Demo",
        lastName: "Customer",
        password: "customer-test-password",
      },
    });
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/customer/login",
      payload: { phone: "+91 98765 43210", password: "customer-test-password" },
    });
    const cookie = cookieValue(login);
    expect(login.statusCode).toBe(200);
    expect(
      (
        await app.inject({
          method: "GET",
          url: "/api/auth/customer/me",
          cookies: { [CUSTOMER_ACCOUNT_COOKIE]: cookie },
        })
      ).json().customer.phone,
    ).toBe("+919876543210");
  });

  it("does not enumerate invalid credentials or duplicate phones", async () => {
    const { repos } = seed();
    const app = buildApp({ repos });
    const payload = {
      phone: "+919876543210",
      firstName: "Demo",
      password: "customer-test-password",
    };
    expect(
      (await app.inject({ method: "POST", url: "/api/auth/customer/signup", payload })).statusCode,
    ).toBe(200);
    const duplicate = await app.inject({
      method: "POST",
      url: "/api/auth/customer/signup",
      payload,
    });
    const invalid = await app.inject({
      method: "POST",
      url: "/api/auth/customer/login",
      payload: { phone: payload.phone, password: "wrong-password-long-enough" },
    });
    expect(duplicate.statusCode).toBe(400);
    expect(duplicate.json()).toEqual({ error: "unable to create account" });
    expect(invalid.statusCode).toBe(401);
    expect(invalid.json()).toEqual({ error: "invalid credentials" });
  });
});
