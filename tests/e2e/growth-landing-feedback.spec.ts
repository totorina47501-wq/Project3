import { test, expect } from '@playwright/test';
import { useLocalSession } from './fixtures/local-session';

test.beforeEach(async ({ page, baseURL }) => {
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === new URL(baseURL!).origin) return route.continue();
    throw new Error(`Requête externe interdite dans ce test : ${url.origin}`);
  });
});

test('lead magnet disponible et collecte marketing réellement désactivée', async ({ page, request, baseURL }) => {
  await page.goto('/?utm_source=reddit&utm_medium=community&utm_campaign=phase1');
  const downloadReady = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Télécharger la checklist (.txt)' }).first().click();
  const download = await downloadReady;
  expect(download.suggestedFilename()).toContain('mentioncheck-checklist-influence-commerciale');

  await expect(page.getByRole('heading', { name: 'Retour communautaire volontaire' })).toBeVisible();
  await expect(page.getByText('La collecte des retours est temporairement indisponible.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Envoyer mon retour' })).toHaveCount(0);
  await expect(page.locator('form')).toHaveCount(0);

  const response = await request.post('/api/marketing/feedback', {
    headers: { origin: new URL(baseURL!).origin },
    data: { consent: true, message: 'Tentative de retour sans stockage durable', origin: 'landing' },
  });
  expect(response.status()).toBe(503);
  expect(await response.json()).not.toHaveProperty('feedbackId');
});

test.skip(process.env.E2E_OFFLINE_AUTH !== '1', 'Nécessite la fixture Supabase HTTP locale.');
test('parcours isolé: visite annonce -> téléchargement -> inscription -> premier diagnostic', async ({ page, context, baseURL }) => {
  await page.goto('/?utm_source=linkedin&utm_medium=community&utm_campaign=phase1');
  const downloadReady = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Télécharger la checklist (.txt)' }).first().click();
  await downloadReady;

  await page.getByRole('link', { name: 'Créer un compte' }).first().click();
  await page.route('**/api/auth/register', async (route) => {
    await route.fulfill({ status: 200, json: { message: 'Vérifie tes emails pour activer le compte.' } });
  });
  await page.getByLabel('Adresse email').fill('phase1@example.test');
  await page.getByLabel('Mot de passe').fill('Mot2Passe!phase1');
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  await expect(page.getByRole('status')).toContainText('Vérifie tes emails');

  await useLocalSession(context, baseURL!);
  await page.route('**/api/check', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: `event: done\ndata: ${JSON.stringify({
        score: 90,
        riskLevel: 'low',
        violations: [],
        aiFlags: [],
        rewrite: null,
        hashSha256: 'offline',
        verificationId: '33333333-3333-4333-8333-333333333333',
        analysisMode: 'rules_only',
        warnings: [],
      })}\n\n`,
    });
  });
  await page.goto('/dashboard/check');
  await page.getByLabel('Légende sponsorisée').fill('Publicité — publication de validation phase 1.');
  await page.getByRole('button', { name: 'Vérifier sans IA' }).click();
  await expect(page.getByRole('heading', { name: 'Contrôle automatique des mentions terminé' })).toBeVisible();
});
