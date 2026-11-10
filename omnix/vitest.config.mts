import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      // `server-only` throws outside the React server build; tests run on the server anyway.
      "server-only": path.resolve(import.meta.dirname, "tests/stubs/empty.ts"),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: { name: "unit", include: ["tests/unit/**/*.test.ts"], environment: "node" },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          environment: "node",
          // Integration tests share one database; run files one at a time.
          fileParallelism: false,
          testTimeout: 120_000,
          hookTimeout: 180_000,
          globalSetup: ["tests/integration/global-setup.ts"],
          env: {
            NODE_ENV: "test",
            DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgres://omnix_app_login:omnix_app_dev@localhost:5432/omnix_test",
            MIGRATION_DATABASE_URL: process.env.TEST_MIGRATION_DATABASE_URL ?? "postgres://omnix_owner:omnix_owner_dev@localhost:5432/omnix_test",
            WORKER_DATABASE_URL: process.env.TEST_WORKER_DATABASE_URL ?? "postgres://omnix_worker_login:omnix_worker_dev@localhost:5432/omnix_test",
            OMNIX_STORAGE_DIR: ".storage-test",
            // Test-only key (32 zero-ish bytes); production refuses to boot without a real one.
            OMNIX_SECRETS_KEY: Buffer.alloc(32, 7).toString("base64"),
            OMNIX_INLINE_JOBS: "false",
            OMNIX_TRUST_PROXY: "true",
            OMNIX_LOCAL_ONNX_ENABLED: "true",
            OMNIX_ALLOW_MODEL_DOWNLOAD: "true",
          },
        },
      },
    ],
  },
});
