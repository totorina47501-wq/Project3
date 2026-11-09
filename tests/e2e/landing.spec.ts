// Chemin : tests/e2e/landing.spec.ts
import { test, expect } from '@playwright/test';

test('accueil public MentionCheck', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 }))
    .toContainText("L'IA qui check vos mentions légales");
  await expect(page.getByRole('link', { name: 'Créer un compte' })).toHaveAttribute('href', '/register');
  await expect(page.getByRole('link', { name: 'Connexion' })).toHaveAttribute('href', '/login');
  await expect(page.getByRole('link', { name: 'Check ma publication' })).toHaveAttribute('href', '/register');
  await expect(page.getByRole('heading', { name: 'Pour qui est fait MentionCheck ?' })).toBeVisible();
  await expect(page.getByText('Les tarifs sont indicatifs et les abonnements payants ne sont pas encore ouverts.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Comparer les tarifs indicatifs' })).toHaveAttribute('href', '/tarifs');
  const legalNavigation = page.getByRole('navigation', { name: 'Informations publiques' });
  await expect(legalNavigation.getByRole('link', { name: 'Confidentialité' })).toHaveAttribute('href', '/legal/confidentialite');
  await expect(legalNavigation.getByRole('link', { name: 'Mentions légales' })).toHaveAttribute('href', '/legal/mentions-legales');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /^https:\/\/[^/]+\/?$/);
});

test('accueil sans collecte ni requête tierce, utilisable sur mobile et au clavier', async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  const thirdPartyRequests: string[] = [];
  const dataRequests: string[] = [];
  page.on('request', request => {
    if (new URL(request.url()).origin !== origin) {
      thirdPartyRequests.push(request.url());
    }
    if (request.method() !== 'GET' || ['fetch', 'xhr'].includes(request.resourceType())) {
      dataRequests.push(request.url());
    }
  });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('form, input, textarea')).toHaveCount(0);
  expect(thirdPartyRequests).toEqual([]);
  expect(dataRequests).toEqual([]);

  for (const width of [320, 360, 390]) {
    await page.setViewportSize({ width, height: 740 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.getByRole('link', { name: 'Check ma publication' })).toBeVisible();
  }

  await page.setViewportSize({ width: 390, height: 844 });
  const keyboardTargets = [
    page.getByRole('link', { name: 'MentionCheck, accueil' }),
    page.getByRole('link', { name: 'Connexion' }),
    page.getByRole('link', { name: 'Créer un compte' }).first(),
    page.getByRole('link', { name: 'Check ma publication' }),
  ];
  for (const target of keyboardTargets) {
    await page.keyboard.press('Tab');
    await expect(target).toBeFocused();
  }
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/register$/);
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
