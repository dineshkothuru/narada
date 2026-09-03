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

  // Who is logged in — drives which nav items and screens the UI offers.
  // The auth plugin has already rejected an absent or expired cookie with 401.
  app.get("/api/admin/me", async (request) => ({ role: request.staffRole }));

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
