import { test, expect } from '@playwright/test';
// Opt-in seulement : l'envoi utilise explicitement rules_only, jamais GPT-4o.
const email = process.env.E2E_TEST_EMAIL;
const password = process.env.E2E_TEST_PASSWORD;
test.skip(!email || !password, 'Compte de test non configuré.');
test('contrôle gratuit sans appel OpenAI', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Adresse email').fill(email!);
  await page.getByLabel('Mot de passe').fill(password!);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL(/\/dashboard(?:\?|$)/);
  await page.goto('/dashboard/check');
  await expect(page.getByRole('radio', { name: /Sans IA, sans crédit/ })).toBeChecked();
  await page.getByLabel('Légende sponsorisée').fill('Mon code promo TEST20 !');
  const checkCalls: string[] = [];
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().endsWith('/api/check'))
      checkCalls.push(request.postData() ?? '');
  });
  await page.getByRole('button', { name: 'Vérifier sans IA' }).click();
  await expect(page.getByText('Contrôle automatique des mentions terminé')).toBeVisible();
  expect(checkCalls.length).toBeGreaterThan(0);
  expect(checkCalls.every((data) => JSON.parse(data).execution === 'rules_only')).toBe(true);
});
