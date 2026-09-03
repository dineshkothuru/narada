import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const root = fileURLToPath(new URL(".", import.meta.url));

// apps/web's "@" points at apps/web/src, which collides with the "@" -> web/
// alias every other workspace here relies on. Splitting into two projects
// gives apps/web its own alias without touching the shared one.
const sharedInclude = [
  "web/tests/**/*.test.ts",
  "apps/api/tests/**/*.test.ts",
  "apps/web/tests/**/*.test.{ts,tsx}",
  "packages/**/tests/**/*.test.ts",
];

export default defineConfig({
  test: {
    environment: "node",
    env: {
      SUPABASE_URL: "http://localhost.test",
      SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
      SESSION_SECRET: "test-session-secret",
      DATABASE_URL: "postgres://test:test@localhost:5432/test",
    },
    // Without an explicit projects list, vitest auto-discovers
    // apps/web/vite.config.ts as a second project and runs the include globs
    // below a second time, double-counting every test. Declaring both
    // projects here also lets apps/web's "@" -> apps/web/src alias coexist
    // with the "@" -> web/ alias every other workspace here relies on.
    projects: [
      {
        extends: true,
        test: {
          name: "default",
          include: sharedInclude,
          exclude: ["apps/web/tests/**"],
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
  resolve: {
    alias: {
      "@": `${root}web`,
      "server-only": `${root}test/server-only-stub.ts`,
    },
  },
});
