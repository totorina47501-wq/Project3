import { expect, test } from '@playwright/test';
import { useLocalSession } from './fixtures/local-session';

test('paramètres affichent OAuth indisponible sans activation explicite', async ({
  page,
  context,
  baseURL,
}) => {
  test.skip(process.env.E2E_OFFLINE_AUTH !== '1', 'Nécessite la fixture Supabase HTTP locale.');
  await useLocalSession(context, baseURL!);
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === new URL(baseURL!).origin) return route.continue();
    throw new Error(`Requête externe interdite dans la recette OAuth hors ligne : ${url.origin}`);
  });

  await page.goto('/dashboard/settings');
  await expect(page.getByRole('heading', { name: 'Mes comptes sociaux déclarés' })).toBeVisible();
  for (const provider of ['Instagram', 'TikTok', 'YouTube', 'LinkedIn']) {
    await expect(page.getByText(`${provider} · Connexion indisponible`)).toBeVisible();
    await expect(page.getByRole('button', { name: `Connecter ${provider}` })).toHaveCount(0);
  }
  await expect(page.getByText('Facebook · Connexion indisponible')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Connecter des Pages Facebook' })).toHaveCount(0);
});

test('Facebook Pages requires explicit selection and never renders tokens', async ({
  page,
  context,
  baseURL,
}) => {
  test.skip(process.env.E2E_OFFLINE_AUTH !== '1', 'Nécessite la fixture Supabase HTTP locale.');
  await useLocalSession(context, baseURL!);
  let selected = false;
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === new URL(baseURL!).origin) return route.continue();
    throw new Error(`Requête externe interdite dans la recette OAuth hors ligne : ${url.origin}`);
  });
  await page.route('**/api/social-accounts/oauth/providers', (route) =>
    route.fulfill({ json: { providers: { instagram: false, tiktok: false, youtube: false, linkedin: false, facebook: true } } }),
  );
  await page.route('**/api/social-accounts/oauth/facebook/pages', async (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        json: { pages: [{ id: '123456789', name: 'Page de test' }] },
      });
    }
    expect(await route.request().postDataJSON()).toEqual({ pageIds: ['123456789'] });
    selected = true;
    return route.fulfill({ json: { selected: 1 } });
  });
  await page.route('**/api/social-accounts?page=1', (route) => route.fulfill({
    json: {
      items: selected ? [{
        id: 'facebook-page',
        platform: 'facebook',
        handle: '123456789',
        display_name: 'Page de test',
        connection_kind: 'oauth',
        connected_at: '2026-11-14T00:00:00.000Z',
      }] : [],
      total: selected ? 1 : 0,
      connectedTotal: selected ? 1 : 0,
      page: 1,
      pageSize: 25,
    },
  }));
  await page.goto('/dashboard/settings?social_oauth=pages&provider=facebook');
  await expect(page.getByRole('group', { name: 'Choisir les Pages Facebook à relier' })).toBeVisible();
  await page.getByLabel('Page de test').check();
  await page.getByRole('button', { name: 'Relier les Pages sélectionnées' }).click();
  await expect(page.getByText('Facebook · Page de test')).toBeVisible();
  await expect(page.locator('body')).not.toContainText('offline-page-token');
});
