import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    include: ["web/tests/**/*.test.ts", "apps/**/*.test.ts", "packages/**/*.test.ts"],
    env: {
      SUPABASE_URL: "http://localhost.test",
      SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
      SESSION_SECRET: "test-session-secret",
    },
  },
  resolve: {
    alias: {
      "@": `${root}web`,
      "server-only": `${root}test/server-only-stub.ts`,
    },
  },
});
