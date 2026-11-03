import { test, expect } from '@playwright/test';
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
  // Aucun appel OpenAI payant : contrôle de navigation uniquement.
});
