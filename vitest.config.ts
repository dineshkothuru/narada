import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const root = fileURLToPath(new URL(".", import.meta.url));

const apiInclude = ["apps/api/tests/**/*.test.ts", "packages/shared/tests/**/*.test.ts"];

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./test/setup.ts"],
    env: {
      SUPABASE_URL: "http://localhost.test",
      SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
      SESSION_SECRET: "test-session-secret",
      DATABASE_URL: "postgres://test:test@localhost:5432/test",
    },
    // Without an explicit projects list, vitest auto-discovers
    // apps/web/vite.config.ts as a second project and runs the include globs
    // below a second time, double-counting every test. Declaring both
    // projects here also gives apps/web its own "@" alias.
    projects: [
      {
        extends: true,
        test: {
          name: "default",
          include: apiInclude,
        },
      },
      {
        extends: true,
        plugins: [react()],
        test: {
          name: "apps/web",
          include: ["apps/web/tests/**/*.test.{ts,tsx}"],
          exclude: [],
        },
        resolve: {
          alias: {
            "@": `${root}apps/web/src`,
          },
        },
      },
    ],
  },
});
