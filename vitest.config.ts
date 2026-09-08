import { defineConfig } from "vitest/config";
import path from "path";

// Only the pure logic modules get automated tests for now (keyword
// stamp-matching, highlight segment-building) — anything touching React,
// Next's server runtime, or Supabase would need a much heavier test
// setup that isn't worth it yet. This config exists mainly to wire up
// the same `@/...` path alias tsconfig.json declares, since vitest
// doesn't read tsconfig path mappings on its own.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
