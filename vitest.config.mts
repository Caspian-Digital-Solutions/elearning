import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      "server-only": new URL("./tests/mocks/server-only.ts", import.meta.url).pathname,
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Access-rule tests need the dev database; they run with `npm run test:rls`.
    exclude: ["tests/rls/**", "node_modules/**"],
  },
});
