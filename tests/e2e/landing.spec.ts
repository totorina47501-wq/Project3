// Chemin : tests/e2e/landing.spec.ts
import { test, expect } from '@playwright/test';

test('accueil public MentionCheck', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 }))
    .toContainText("L'IA qui check vos mentions légales");
  await expect(page.getByRole('link', { name: 'Créer un compte' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Pour qui est fait MentionCheck ?' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Comparer les tarifs indicatifs' })).toHaveAttribute('href', '/tarifs');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /^https:\/\/[^/]+\/?$/);
});

test('canonical limité à l’accueil', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
  for (const route of ['/tarifs', '/login', '/legal/cgu']) {
    await page.goto(route);
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
    await expect(page.locator('meta[property="og:url"]')).toHaveCount(0);
  }
});

test('robots et sitemap excluent les routes privées ou non commercialisées', async ({ request }) => {
  const robots = await request.get('/robots.txt');
  expect(robots.ok()).toBeTruthy();
  const robotsText = await robots.text();
  for (const path of ['/api/', '/dashboard', '/login', '/register', '/tarifs']) {
    expect(robotsText).toContain(`Disallow: ${path}`);
  }

  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.ok()).toBeTruthy();
  const xml = await sitemap.text();
  const urls = Array.from(xml.matchAll(/<loc>(.*?)<\/loc>/g), ([, url]) => url);
  expect(urls).toHaveLength(1);
  expect(new Set(urls).size).toBe(urls.length);
  const [sitemapUrl] = urls;
  expect(sitemapUrl).toBeDefined();
  if (!sitemapUrl) return;
  expect(new URL(sitemapUrl).pathname).toBe('/');
});

test('formulaire de connexion disponible sur mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Content de te retrouver !' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Se connecter' })).toBeVisible();
});
