import fastifyCookie from "@fastify/cookie";
import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import authPlugin, {
  ADMIN_COOKIE,
  canAccess,
  clearRoleCookie,
  rolesForPath,
  roleToken,
  setRoleCookie,
  STAFF_ROLES,
  verifyToken,
  type StaffRole,
} from "../../src/plugins/auth.js";

// A stand-in app with one route per gated prefix, so the hook is exercised the
// way the real routes will be rather than through a hand-called function.
function dummyApp(): FastifyInstance {
  const app = Fastify();
  app.register(fastifyCookie);
  app.register(authPlugin);
  app.get("/api/admin/me", async (req) => ({ role: req.staffRole }));
  app.get("/api/admin/settings", async () => ({ ok: true }));
  app.get("/api/kitchen", async () => ({ ok: true }));
  app.get("/api/counter", async () => ({ ok: true }));
  app.get("/api/session", async () => ({ ok: true }));
  app.post("/api/admin/login", async () => ({ ok: true }));
  return app;
}

const cookieFor = async (role: StaffRole) => `${ADMIN_COOKIE}=${await roleToken(role)}`;

afterEach(() => {
  vi.useRealTimers();
});

describe("token", () => {
  it("round-trips every staff role", async () => {
    for (const role of STAFF_ROLES) {
      expect(await verifyToken(await roleToken(role))).toBe(role);
    }
  });

  it("rejects a tampered role, expiry or signature", async () => {
    const token = await roleToken("waiter");
    const [, exp, hash] = token.split(".");
    expect(await verifyToken(`admin.${exp}.${hash}`)).toBeNull();
    expect(await verifyToken(`waiter.${Number(exp) + 1}.${hash}`)).toBeNull();
    expect(await verifyToken(`waiter.${exp}.${"0".repeat(64)}`)).toBeNull();
    expect(await verifyToken("not-a-role.1.2")).toBeNull();
    expect(await verifyToken(undefined)).toBeNull();
  });

  it("expires after 12 hours", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-03T10:00:00Z"));
    const token = await roleToken("admin");
    expect(await verifyToken(token)).toBe("admin");

    vi.setSystemTime(new Date("2026-09-03T21:59:00Z"));
    expect(await verifyToken(token)).toBe("admin");

    vi.setSystemTime(new Date("2026-09-03T22:01:00Z"));
    expect(await verifyToken(token)).toBeNull();
  });
});

describe("rolesForPath / canAccess", () => {
  it("gives /api/admin/me its own wider rule despite the /api/admin prefix", () => {
    expect(rolesForPath("/api/admin/me")).toEqual([...STAFF_ROLES]);
    expect(rolesForPath("/api/admin/settings")).toEqual(["admin"]);
  });

  it("matches segment-aware, so /admin never claims /administrator", () => {
    expect(rolesForPath("/administrator")).toBeNull();
    expect(rolesForPath("/api/session")).toBeNull();
  });

  it("lets an ungated path through for a signed-in role but never for nobody", () => {
    expect(canAccess("/api/session", "kitchen")).toBe(true);
    expect(canAccess("/api/session", null)).toBe(false);
    expect(canAccess("/api/counter", "cashier")).toBe(true);
    expect(canAccess("/api/counter", "waiter")).toBe(false);
  });
});

describe("onRequest gate", () => {
  it("401s a gated route with no cookie", async () => {
    const res = await dummyApp().inject({ url: "/api/admin/settings" });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: "unauthorized" });
  });

  it("403s a valid cookie for the wrong role", async () => {
    const res = await dummyApp().inject({
      url: "/api/admin/settings",
      headers: { cookie: await cookieFor("kitchen") },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: "forbidden for your role" });
  });

  it("200s the right role", async () => {
    const res = await dummyApp().inject({
      url: "/api/admin/settings",
      headers: { cookie: await cookieFor("admin") },
    });
    expect(res.statusCode).toBe(200);
  });

  it("lets every signed-in role reach /api/admin/me", async () => {
    for (const role of STAFF_ROLES) {
      const res = await dummyApp().inject({
        url: "/api/admin/me",
        headers: { cookie: await cookieFor(role) },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ role });
    }
  });

  it("exempts /api/admin/login so a logged-out staffer can sign in", async () => {
    const res = await dummyApp().inject({ method: "POST", url: "/api/admin/login" });
    expect(res.statusCode).toBe(200);
  });

  it("leaves customer endpoints open and reports no role", async () => {
    const res = await dummyApp().inject({ url: "/api/session?table=t1-demo" });
    expect(res.statusCode).toBe(200);
  });

  it("403s a role the counter excludes", async () => {
    const res = await dummyApp().inject({
      url: "/api/counter",
      headers: { cookie: await cookieFor("waiter") },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe("cookie helpers", () => {
  it("sets and clears the staff cookie", async () => {
    const app = Fastify();
    app.register(fastifyCookie);
    app.post("/in", async (_req, reply) => {
      setRoleCookie(reply, await roleToken("admin"));
      return { ok: true };
    });
    app.delete("/out", async (_req, reply) => {
      clearRoleCookie(reply);
      return { ok: true };
    });

    const login = await app.inject({ method: "POST", url: "/in" });
    const setCookie = login.headers["set-cookie"];
    const header = Array.isArray(setCookie) ? setCookie[0] : setCookie;
    expect(header).toContain(`${ADMIN_COOKIE}=`);
    expect(header).toContain("HttpOnly");
    expect(header).toContain("SameSite=Lax");
    expect(header).toContain("Max-Age=43200");
    expect(header).toContain("Path=/");

    const value = /narada_admin=([^;]+)/.exec(header ?? "")?.[1];
    expect(await verifyToken(decodeURIComponent(value ?? ""))).toBe("admin");

    const logout = await app.inject({ method: "DELETE", url: "/out" });
    const cleared = logout.headers["set-cookie"];
    expect(Array.isArray(cleared) ? cleared[0] : cleared).toContain("narada_admin=;");
  });
});
