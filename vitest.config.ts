// Chemin : vitest.config.ts
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    setupFiles: ['./tests/setup/block-network.ts'], include: ['tests/unit/**/*.test.ts'], environment: 'node' },
});
