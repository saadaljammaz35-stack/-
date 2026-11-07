import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    include: ["tests/**/*.test.ts"],
    env: {
      APP_URL: "http://localhost:3100",
      DATABASE_URL: "postgresql://mubayn:mubayn_local_dev@localhost:5432/mubayn_test",
      ENCRYPTION_KEY: "dGVzdC1rZXktdGVzdC1rZXktdGVzdC1rZXktdGVzdC0xMjM0NTY3OA==",
      STORAGE_DRIVER: "local",
      LOCAL_STORAGE_DIR: ".storage-test",
    },
  },
});
