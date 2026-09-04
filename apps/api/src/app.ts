import fastifyCookie from "@fastify/cookie";
import fastifyHelmet from "@fastify/helmet";
import fastifyRateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import Fastify, { type FastifyError, type FastifyInstance } from "fastify";
import Redis from "ioredis";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { db } from "./db/index.js";
import { type Deps, makeDeps } from "./deps.js";
import { env, trustedProxyHops } from "./env.js";
import { clientIp } from "./lib/ratelimit.js";
import authPlugin from "./plugins/auth.js";
import { type Repos } from "./repositories/index.js";
import billRoutes from "./routes/bill.js";
import publicMenuRoutes from "./routes/menu.js";
import orderRoutes from "./routes/order.js";
import rewardRoutes from "./routes/reward.js";
import sessionRoutes from "./routes/session.js";
import voiceRoutes from "./routes/voice.js";
import waiterCallRoutes from "./routes/waiterCall.js";
import categoriesRoutes from "./routes/admin/categories.js";
import imageRoutes from "./routes/admin/image.js";
import meRoutes from "./routes/admin/me.js";
import menuRoutes from "./routes/admin/menu.js";
import ordersRoutes from "./routes/admin/orders.js";
import settingsRoutes from "./routes/admin/settings.js";
import staffRoutes from "./routes/admin/staff.js";
import authLoginRoutes from "./routes/auth/login.js";
import authPasswordRoutes from "./routes/auth/password.js";
import customerAuthRoutes from "./routes/auth/customer.js";
import tablesRoutes from "./routes/admin/tables.js";
import counterRoutes from "./routes/counter.js";
import floorRoutes from "./routes/floor.js";
import kitchenRoutes from "./routes/kitchen.js";
import waiterRoutes from "./routes/waiter.js";
import waiterTipsRoutes from "./routes/waiterTips.js";
import customerSessionRoutes from "./routes/customerSession.js";
import availabilityRoutes from "./routes/availability.js";
import reportRoutes from "./routes/admin/report.js";
import waiterMenuRoutes from "./routes/waiterMenu.js";
import waiterDictateRoutes from "./routes/waiterDictate.js";
import kotRoutes from "./routes/kot.js";

declare module "fastify" {
  interface FastifyInstance {
    repos: Repos;
    deps: Deps;
  }
}

export type BuildAppOptions = {
  logger?: boolean;
  /** @deprecated pass `deps: { repos }` instead */
  repos?: Repos;
  // tests inject in-memory fakes instead of opening a Postgres pool
  deps?: Partial<Deps>;
};

export function buildApp(opts?: BuildAppOptions): FastifyInstance {
  // Trust no proxy by default. Set TRUST_PROXY_HOPS=1 only after confirming
  // the deployment has exactly one edge proxy hop (for example, Railway).
  const app = Fastify({
    logger: opts?.logger ?? false,
    trustProxy: trustedProxyHops > 0 ? (_address, hop) => hop < trustedProxyHops : false,
    requestIdHeader: false,
    genReqId: () => randomUUID(),
  });
  const redis = env.REDIS_URL
    ? new Redis(env.REDIS_URL, { connectTimeout: 10_000, maxRetriesPerRequest: 1 })
    : null;

  app.register(fastifyCookie);
  app.register(fastifyHelmet);
  app.register(fastifyRateLimit, {
    global: false,
    keyGenerator: clientIp,
    ...(redis ? { redis } : {}),
    errorResponseBuilder: () => ({
      statusCode: 429,
      message: "too many requests",
    }),
  });
  app.addHook("onSend", async (request, reply) => {
    reply.header("x-request-id", request.id);
  });
  app.addHook("onClose", async () => {
    if (redis) await redis.quit();
  });
  app.register(authPlugin);

  // pg.Pool connects lazily, so tests that never touch a repo never open a
  // socket; passing fakes replaces the real ones entirely
  const deps = makeDeps(db, {
    ...opts?.deps,
    repos: opts?.deps?.repos ?? opts?.repos,
  });
  app.decorate("deps", deps);
  app.decorate("repos", deps.repos);

  const health = async () => ({ ok: true });
  app.get("/health", health);
  app.get("/api/health", health);

  // Admin routes — moved out of this file into src/routes/admin/*.ts.
  app.register(categoriesRoutes);
  app.register(imageRoutes);
  app.register(authLoginRoutes);
  app.register(authPasswordRoutes);
  app.register(customerAuthRoutes);
  app.register(meRoutes);
  app.register(menuRoutes);
  app.register(ordersRoutes);
  app.register(settingsRoutes);
  app.register(staffRoutes);
  app.register(tablesRoutes);
  app.register(reportRoutes);

  app.register(kitchenRoutes);
  app.register(kotRoutes);
  app.register(availabilityRoutes);
  app.register(waiterRoutes);
  app.register(waiterMenuRoutes);
  app.register(waiterDictateRoutes);
  app.register(waiterTipsRoutes);
  app.register(floorRoutes);
  app.register(counterRoutes);

  // Customer-facing public routes.
  app.register(sessionRoutes);
  app.register(customerSessionRoutes);
  app.register(publicMenuRoutes);
  app.register(orderRoutes);
  app.register(billRoutes);
  app.register(rewardRoutes);
  app.register(waiterCallRoutes);
  app.register(voiceRoutes);

  app.setErrorHandler((error: FastifyError, request, reply) => {
    request.log.error(error);
    const statusCode = error.statusCode ?? 500;
    reply.status(statusCode).send({ error: statusCode === 500 ? "internal error" : error.message });
  });

  if (env.WEB_DIST) {
    const webDist = resolve(env.WEB_DIST);
    app.register(fastifyStatic, {
      root: webDist,
      wildcard: false,
    });
    app.setNotFoundHandler((request, reply) => {
      if (request.method === "GET" && !request.url.startsWith("/api")) {
        reply.type("text/html").send(readFileSync(join(webDist, "index.html")));
        return;
      }
      reply.status(404).send({ error: "not found" });
    });
  }

  return app;
}
