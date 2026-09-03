import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    include: ["web/**/*.test.ts", "apps/**/*.test.ts", "packages/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": `${root}web`,
      "server-only": `${root}test/server-only-stub.ts`,
    },
  },
});
