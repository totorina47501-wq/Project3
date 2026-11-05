import { test, expect } from '@playwright/test';

test('tarifs indicatifs, comparaison et checkout réel indisponible', async ({ page }) => {
  await page.goto('/tarifs');
  await expect(page.getByRole('heading', { name: 'Un forfait adapté à votre rythme de création' })).toBeVisible();
  await expect(page.getByText('Tarifs indicatifs : aucune offre payante n’est actuellement commercialisée.')).toBeVisible();
  for (const name of ['Solo', 'Pro', 'Studio']) {
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  }
  await expect(page.getByRole('heading', { name: 'Comparer les offres' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Questions fréquentes' })).toBeVisible();
  await expect(page.getByRole('button', { name: /paiement Stripe test/i })).toHaveCount(0);
});
