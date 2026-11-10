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
});
