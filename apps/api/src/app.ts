import fastifyCookie from "@fastify/cookie";
import fastifyCors from "@fastify/cors";
import fastifyRateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import Fastify, { type FastifyError, type FastifyInstance } from "fastify";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "./db/index.js";
import { env } from "./env.js";
import { clientIp } from "./lib/ratelimit.js";
import authPlugin from "./plugins/auth.js";
import { makeRepos, type Repos } from "./repositories/index.js";
import annaRoutes from "./routes/anna.js";
import billRoutes from "./routes/bill.js";
import orderRoutes from "./routes/order.js";
import rewardRoutes from "./routes/reward.js";
import sessionRoutes from "./routes/session.js";
import voiceRoutes from "./routes/voice.js";
import waiterCallRoutes from "./routes/waiterCall.js";
import categoriesRoutes from "./routes/admin/categories.js";
import imageRoutes from "./routes/admin/image.js";
import loginRoutes from "./routes/admin/login.js";
import meRoutes from "./routes/admin/me.js";
import menuRoutes from "./routes/admin/menu.js";
import ordersRoutes from "./routes/admin/orders.js";
import settingsRoutes from "./routes/admin/settings.js";
import staffRoutes from "./routes/admin/staff.js";
import tablesRoutes from "./routes/admin/tables.js";
import counterRoutes from "./routes/counter.js";
import floorRoutes from "./routes/floor.js";
import kitchenRoutes from "./routes/kitchen.js";
import waiterRoutes from "./routes/waiter.js";
import waiterTipsRoutes from "./routes/waiterTips.js";

declare module "fastify" {
  interface FastifyInstance {
    repos: Repos;
  }
}

export type BuildAppOptions = {
  logger?: boolean;
  // tests inject in-memory fakes instead of opening a Postgres pool
  repos?: Repos;
};

export function buildApp(opts?: BuildAppOptions): FastifyInstance {
  const app = Fastify({ logger: opts?.logger ?? false });

  app.register(fastifyCookie);
  app.register(fastifyCors, { origin: true, credentials: true });
  app.register(fastifyRateLimit, { global: false, keyGenerator: clientIp });
  app.register(authPlugin);

  // pg.Pool connects lazily, so tests that never touch a repo never open a
  // socket; passing fakes replaces the real ones entirely
  app.decorate("repos", opts?.repos ?? makeRepos(db));

  const health = async () => ({ ok: true });
  app.get("/health", health);
  app.get("/api/health", health);

  // Admin routes — moved out of this file into src/routes/admin/*.ts.
  app.register(categoriesRoutes);
  app.register(imageRoutes);
  app.register(loginRoutes);
  app.register(meRoutes);
  app.register(menuRoutes);
  app.register(ordersRoutes);
  app.register(settingsRoutes);
  app.register(staffRoutes);
  app.register(tablesRoutes);

  app.register(kitchenRoutes);
  app.register(waiterRoutes);
  app.register(waiterTipsRoutes);
  app.register(floorRoutes);
  app.register(counterRoutes);

  // Customer-facing public routes.
  app.register(sessionRoutes);
  app.register(orderRoutes);
  app.register(billRoutes);
  app.register(rewardRoutes);
  app.register(waiterCallRoutes);
  app.register(annaRoutes);
  app.register(voiceRoutes);

  app.setErrorHandler((error: FastifyError, request, reply) => {
    request.log.error(error);
    const statusCode = error.statusCode ?? 500;
    reply.status(statusCode).send({ error: statusCode === 500 ? "internal error" : error.message });
  });

  if (env.WEB_DIST) {
    const webDist = env.WEB_DIST;
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
