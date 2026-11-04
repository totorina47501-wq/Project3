// Chemin : tests/e2e/landing.spec.ts
import { test, expect } from '@playwright/test';

test('accueil public MentionCheck', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 }))
    .toContainText("L'IA qui check vos mentions légales");
  await expect(page.getByRole('link', { name: 'Créer un compte' })).toBeVisible();
});

test('formulaire de connexion disponible sur mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Content de te retrouver !' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Se connecter' })).toBeVisible();
});
