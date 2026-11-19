import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src'), 'server-only': path.resolve(__dirname, 'tests/server-only-stub.ts') } },
  test: { include: ['tests/db/**/*.test.ts'], environment: 'node', testTimeout: 60000, fileParallelism: false },
});
