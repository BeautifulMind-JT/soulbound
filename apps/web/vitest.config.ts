import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["app/**/*.test.ts", "components/**/*.test.ts"],
    exclude: ["**/*.integration.test.ts", ".next/**"],
  },
});
