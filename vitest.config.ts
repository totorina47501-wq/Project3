// Chemin : vitest.config.ts
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    setupFiles: ['./tests/setup/block-network.ts'], include: ['tests/unit/**/*.test.ts'], environment: 'node' },
});
