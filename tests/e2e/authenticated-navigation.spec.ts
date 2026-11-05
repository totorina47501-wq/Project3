import { test, expect } from '@playwright/test';
import { useLocalSession } from './fixtures/local-session';
const email = process.env.E2E_TEST_EMAIL;
const password = process.env.E2E_TEST_PASSWORD;
test.skip(!email || !password, 'Identifiants de compte de test non configurés.');
test('connexion, cockpit, archives et Mia', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Adresse email').fill(email!);
  await page.getByLabel('Mot de passe').fill(password!);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL(/\/dashboard(?:\?|$)/);
  await page.getByRole('link', { name: 'Archives', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Mes archives' })).toBeVisible();
  await page.getByRole('link', { name: 'Parler à Mia', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Parler avec Mia' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Mia', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Nouvelle discussion' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Envoyer à Mia' })).toBeDisabled();
  await page.getByRole('button', { name: 'Quelles mentions pour un lien affilié ?' }).click();
  await expect(page.getByRole('textbox', { name: 'Ta question' })).toHaveValue('Quelles mentions pour un lien affilié ?');
  // Aucun appel OpenAI payant : contrôle de navigation uniquement.
});

test('la navigation mobile authentifiée est accessible au clavier hors ligne', async ({ page, context, baseURL }) => {
  test.skip(process.env.E2E_OFFLINE_AUTH !== '1', 'Nécessite la fixture Supabase HTTP locale.');
  await useLocalSession(context, baseURL!);
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === new URL(baseURL!).origin) return route.continue();
    throw new Error(`Requête externe interdite : ${url.origin}`);
  });
  await page.setViewportSize({ width: 360, height: 740 });

  const session = await page.request.get('/api/mia/conversations');
  expect(session.status()).toBe(200);
  await page.goto('/dashboard');
  const navigation = page.getByRole('navigation', { name: 'Navigation mobile' });
  await expect(navigation).toBeVisible();
  const destinations = [
    { name: 'Cockpit', path: '/dashboard' },
    { name: 'Check', path: '/dashboard/check' },
    { name: 'Mia', path: '/dashboard/mia' },
    { name: 'Médias', path: '/dashboard/media' },
    { name: 'Archives', path: '/dashboard/archive' },
  ];

  for (const [index, { name, path }] of destinations.entries()) {
    const link = navigation.getByRole('link', { name, exact: true });
    await expect(link).toBeVisible();
    const size = await link.evaluate((element) => {
      const { width, height } = element.getBoundingClientRect();
      return { width, height };
    });
    expect(size.width).toBeGreaterThanOrEqual(44);
    expect(size.height).toBeGreaterThanOrEqual(44);
    if (index > 0) await link.click();
    await expect(page).toHaveURL(new URL(path, baseURL!).toString());
    await expect(link).toHaveAttribute('aria-current', 'page');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }

  await page.goto('/dashboard');
  const cockpit = navigation.getByRole('link', { name: 'Cockpit', exact: true });
  await cockpit.focus();
  for (const name of ['Check', 'Mia', 'Médias', 'Archives']) {
    await page.keyboard.press('Tab');
    const link = navigation.getByRole('link', { name, exact: true });
    await expect(link).toBeFocused();
    if (name === 'Check') await expect(link).toHaveCSS('outline-style', 'solid');
  }
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new URL('/dashboard/archive', baseURL!).toString());
  await expect(navigation.getByRole('link', { name: 'Archives', exact: true })).toHaveAttribute('aria-current', 'page');
});
