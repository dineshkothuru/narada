import { env } from "./env.js";
import { buildApp } from "./app.js";

const app = buildApp({ logger: true });

app.listen({ port: env.PORT ? Number(env.PORT) : 3001, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
