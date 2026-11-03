import { test, expect } from '@playwright/test';
test('Mia et les archives restent privées', async ({ page }) => {
  for (const path of ['/dashboard/mia', '/dashboard/archive']) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login(?:\?|$)/);
    await expect(page.getByRole('heading', { name: 'Content de te retrouver !' })).toBeVisible();
  }
});
test('les endpoints privés rejettent un invité', async ({ request }) => {
  const history = await request.get('/api/mia/conversations');
  expect(history.status()).toBe(401);
  const chat = await request.post('/api/mia/chat', {
    data: { question: 'Quelles mentions pour une publicité ?' },
  });
  expect(chat.status()).toBe(401);
  const report = await request.get('/api/archive/33333333-3333-4333-8333-333333333333/pdf');
  expect(report.status()).toBe(401);
});
