// Chemin : playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

// La suite locale authentifiée n'accède qu'à la fixture HTTP du dépôt.
// NextURL normalise les adresses loopback en localhost : même origine côté navigateur.
const offline = !process.env.PLAYWRIGHT_BASE_URL;
if (offline) {
  process.env.E2E_OFFLINE_AUTH = '1';
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54329';
  process.env.E2E_TEST_EMAIL = 'createur@example.test';
  process.env.E2E_TEST_PASSWORD = 'Fixture-local-2026!';
}

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? {
      launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE },
    } : {}),
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  ...(process.env.PLAYWRIGHT_BASE_URL ? {} : { webServer: {
    command: 'node scripts/e2e-server.mjs',
    url: 'http://localhost:3000',
    reuseExistingServer: false,
    timeout: 120_000,
  } }),
});
