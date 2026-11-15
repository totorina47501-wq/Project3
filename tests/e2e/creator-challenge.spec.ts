import { test, expect } from '@playwright/test';
import { localScenario, useScenarioActor } from './fixtures/scenario';

test('le programme est privé pour les invités', async ({ page }) => {
  await page.goto('/dashboard/creator-challenge');
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
});

test('progression locale accessible, conservée et séparée entre comptes hors ligne', async ({ browser, request, baseURL }) => {
  test.skip(process.env.E2E_OFFLINE_AUTH !== '1', 'Nécessite la fixture Supabase HTTP locale.');
  const scenario = await localScenario(request);
  const context = await browser.newContext();
  try {
    await useScenarioActor(context, baseURL!, scenario.actors.owner);
    await context.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.origin === new URL(baseURL!).origin) return route.continue();
      throw new Error(`Requête externe interdite : ${url.origin}`);
    });
    const page = await context.newPage();
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto('/dashboard/creator-challenge');
    await expect(page.getByRole('heading', { name: 'Mon programme créateur — 30 jours' })).toBeVisible();
    await expect(page.getByText('Progression uniquement sur cet appareil.')).toBeVisible();
    await page.getByLabel('Niche').selectOption('cuisine');
    await page.getByLabel('Plateforme').selectOption('tiktok');
    await page.getByLabel('Objectif').selectOption('communaute');
    await page.getByRole('button', { name: 'Commencer le jour 1' }).click();
    await expect(page.getByRole('checkbox')).toHaveCount(30);
    for (const width of [320, 360, 390]) {
      await page.setViewportSize({ width, height: 740 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    const dayOne = page.getByRole('checkbox', { name: /Jour 1 —/ });
    await expect(dayOne).toBeVisible();
    const touchTarget = await dayOne.evaluate((checkbox) => {
      const { width, height } = checkbox.parentElement!.getBoundingClientRect();
      return { width, height };
    });
    expect(touchTarget.width).toBeGreaterThanOrEqual(44);
    expect(touchTarget.height).toBeGreaterThanOrEqual(44);
    await dayOne.focus();
    await page.keyboard.press('Space');
    await expect(dayOne).toBeChecked();
    await expect(page.getByText('1 sur 30 missions terminées')).toBeVisible();
    await expect(page.getByText(/sujets de Cuisine/i)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Préparer un brouillon avec Mia Creator' }))
      .toHaveAttribute('href', '/dashboard/mia/creator');
    await expect(page.getByRole('link', { name: 'Préparer mon media kit existant' }))
      .toHaveAttribute('href', '/dashboard/brand-deals');

    const storage = await page.evaluate(() => ({
      keys: Object.keys(localStorage),
      values: Object.values(localStorage),
    }));
    expect(storage.keys).toHaveLength(1);
    expect(storage.keys[0]).toMatch(/^mentioncheck:creator-challenge:v1:[a-f0-9]{64}$/);
    expect(JSON.stringify(storage)).not.toContain(scenario.actors.owner.id);
    expect(JSON.stringify(storage)).not.toContain(scenario.actors.owner.email);
    expect(JSON.stringify(storage)).not.toContain('not persisted');

    await page.reload();
    await expect(page.getByRole('checkbox', { name: /Jour 1 —/ })).toBeChecked();
    await expect(page.getByLabel('Plateforme')).toHaveValue('tiktok');

    await useScenarioActor(context, baseURL!, scenario.actors.outsider);
    await page.reload();
    await expect(page.getByText('0 sur 30 missions terminées')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Commencer le jour 1' })).toBeVisible();

    await useScenarioActor(context, baseURL!, scenario.actors.owner);
    await page.reload();
    await expect(page.getByText('1 sur 30 missions terminées')).toBeVisible();
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Réinitialiser ma progression' }).click();
    await expect(page.getByRole('button', { name: 'Commencer le jour 1' })).toBeVisible();
    await expect(page.getByRole('status')).toContainText('a été effacée');
    await expect.poll(() => page.evaluate(() => Object.keys(localStorage).length)).toBe(0);
    await page.reload();
    await expect(page.getByText('0 sur 30 missions terminées')).toBeVisible();
    await expect(page.getByLabel('Niche')).toHaveValue('autre');
  } finally {
    await context.close();
  }
});
