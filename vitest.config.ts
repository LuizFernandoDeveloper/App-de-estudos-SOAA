import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/client/**/*.test.{ts,tsx}"],
    setupFiles: ["src/client/test/setup.ts"],
    restoreMocks: true,
    testTimeout: 20000,
    hookTimeout: 20000,
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["src/client/**/*.{ts,tsx}"],
      exclude: ["src/client/**/*.test.{ts,tsx}", "src/client/test/**", "src/client/main.tsx", "src/client/vite-env.d.ts"],
      thresholds: {
        statements: 100,
        lines: 100,
        functions: 100,
        branches: 100
      }
    }
  }
});