import Fastify from "fastify";
import { buildApp } from "./apps/api/src/app.js";

// The direct framework import lets Vercel's Fastify builder detect this entrypoint.
void Fastify;

export default buildApp({ logger: true });
