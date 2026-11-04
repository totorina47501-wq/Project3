import { test, expect } from '@playwright/test';
test('prix annoncés comme indicatifs sans checkout actif', async ({ page }) => {
  await page.goto('/tarifs');
  await expect(page.getByRole('heading', { name: 'Tarifs indicatifs' })).toBeVisible();
  await expect(page.getByText('Ouverture des abonnements après validation.').first()).toBeVisible();
  await expect(page.getByRole('button', { name: /paiement Stripe test/i })).toHaveCount(0);
});
