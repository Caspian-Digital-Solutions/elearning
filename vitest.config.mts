import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Access-rule tests need the dev database; they run with `npm run test:rls`.
    exclude: ["tests/rls/**", "node_modules/**"],
  },
});
