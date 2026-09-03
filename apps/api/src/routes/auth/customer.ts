import type { FastifyInstance } from "fastify";
import { customerLoginSchema, customerPasswordSchema, customerSignupSchema } from "@narada/shared";
import { rateLimited } from "../../lib/ratelimit.js";
import { clearCustomerAccountCookie, setCustomerAccountCookie } from "../../lib/customerAuth.js";
import { changePassword, login, signup } from "../../services/customerAuth.js";

export default async function customerAuthRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/auth/customer/signup", { ...rateLimited(5) }, async (request, reply) => {
    const parsed = customerSignupSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "invalid signup" });
    const result = await signup(app.repos, parsed.data);
    if (!result) return reply.status(400).send({ error: "unable to create account" });
    setCustomerAccountCookie(reply, result.token);
    return reply.send({ ok: result.ok, customer: result.customer });
  });

  app.post("/api/auth/customer/login", { ...rateLimited(10) }, async (request, reply) => {
    const parsed = customerLoginSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(401).send({ error: "invalid credentials" });
    const result = await login(app.repos, parsed.data);
    if (!result) return reply.status(401).send({ error: "invalid credentials" });
    setCustomerAccountCookie(reply, result.token);
    return reply.send({ ok: result.ok, customer: result.customer });
  });

  app.delete("/api/auth/customer/login", async (_request, reply) => {
    clearCustomerAccountCookie(reply);
    return reply.send({ ok: true });
  });

  app.get("/api/auth/customer/me", async (request, reply) => {
    if (!request.customerSession) return reply.status(401).send({ error: "unauthorized" });
    return reply.send({ ok: true, customer: request.customerSession.customer });
  });

  app.patch("/api/auth/customer/password", async (request, reply) => {
    if (!request.customerSession) return reply.status(401).send({ error: "unauthorized" });
    const parsed = customerPasswordSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "invalid password" });
    return changePassword(
      app.repos,
      request.customerSession.customer.id,
      parsed.data.currentPassword,
      parsed.data.newPassword,
    );
  });
}
