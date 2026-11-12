import { expect, test } from '@playwright/test';

test('statistiques bloquées sans accord, refus simple et conservé', async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  const thirdPartyRequests: string[] = [];

  page.on('request', request => {
    if (new URL(request.url()).origin !== origin) thirdPartyRequests.push(request.url());
  });

  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Choix des cookies statistiques' })).toBeVisible();
  await expect(page.locator('script[src*="googletagmanager.com"]')).toHaveCount(0);

  await page.getByRole('button', { name: 'Refuser les statistiques' }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Gérer les cookies' })).toBeVisible();
  await expect(page.locator('script[src*="googletagmanager.com"]')).toHaveCount(0);
  expect(thirdPartyRequests).toEqual([]);

  await page.getByRole('button', { name: 'Gérer les cookies' }).click();
  await expect(page.getByRole('button', { name: 'Refuser les statistiques' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Autoriser les statistiques' })).toBeVisible();
});

test('Google tag seulement après accord, retrait persistant', async ({ page }) => {
  const tags: string[] = [];
  await page.route('https://www.googletagmanager.com/**', async route => {
    tags.push(route.request().url());
    await route.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
  });

  await page.goto('/');
  await expect(page.locator('script[src*="googletagmanager.com"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Autoriser les statistiques' }).click();
  await expect(page.locator('script[src*="gtm.js?id=GTM-WQKLMJPM"]')).toHaveCount(1);
  await expect.poll(() => tags.length).toBe(1);

  await page.getByRole('button', { name: 'Gérer les cookies' }).click();
  await page.getByRole('button', { name: 'Refuser les statistiques' }).click();
  await expect(page.locator('script[src*="googletagmanager.com"]')).toHaveCount(0);
  expect(await page.evaluate(() => window.localStorage.getItem('mentioncheck.analytics-consent.v1'))).toBe('rejected');
});

test('un visiteur sans choix peut utiliser login sans bannière bloquante', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('region', { name: 'Choix des cookies statistiques' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Se connecter' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Gérer les cookies' })).toBeVisible();
  await expect(page.locator('script[src*="googletagmanager.com"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Gérer les cookies' }).click();
  await expect(page.getByRole('region', { name: 'Choix des cookies statistiques' })).toBeVisible();
});
