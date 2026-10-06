import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      // "server-only" kastar utanför Next.js serverkomponenter; i tester ersätts det av en tom modul.
      "server-only": path.resolve(import.meta.dirname, "tests/support/server-only-stub.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/support/global-setup.ts"],
    env: {
      DATABASE_URL: "file:./test.db",
      MOCK_AI: "true",
    },
    fileParallelism: false,
  },
});
