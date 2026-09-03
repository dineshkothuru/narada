import fastifyCookie from "@fastify/cookie";
import fastifyCors from "@fastify/cors";
import fastifyRateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import Fastify, { type FastifyError, type FastifyInstance } from "fastify";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { env } from "./env.js";

export function buildApp(opts?: { logger?: boolean }): FastifyInstance {
  const app = Fastify({ logger: opts?.logger ?? false });

  app.register(fastifyCookie);
  app.register(fastifyCors, { origin: true, credentials: true });
  app.register(fastifyRateLimit, { global: false });

  const health = async () => ({ ok: true });
  app.get("/health", health);
  app.get("/api/health", health);

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
