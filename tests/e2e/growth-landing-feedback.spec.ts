import { test, expect } from '@playwright/test';
import { useLocalSession } from './fixtures/local-session';

test.beforeEach(async ({ page, baseURL }) => {
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === new URL(baseURL!).origin) return route.continue();
    throw new Error(`Requête externe interdite dans ce test : ${url.origin}`);
  });
});

test('lead magnet téléchargeable et feedback consenti supprimable', async ({ page }) => {
  await page.goto('/?utm_source=reddit&utm_medium=community&utm_campaign=phase1');
  const downloadReady = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Télécharger la checklist (.txt)' }).first().click();
  const download = await downloadReady;
  expect(download.suggestedFilename()).toContain('mentioncheck-checklist-influence-commerciale');

  let submitRequests = 0;
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/marketing/feedback' && request.method() === 'POST') {
      submitRequests += 1;
    }
  });

  await page.getByLabel('Votre retour (minimum 20 caractères)').fill('Ce test valide le formulaire de retour volontaire avec consentement explicite.');
  await page.getByRole('button', { name: 'Envoyer mon retour' }).click();
  expect(submitRequests).toBe(0);

  await page.getByRole('checkbox', { name: /J'autorise l'enregistrement local/ }).check();
  await page.getByRole('button', { name: 'Envoyer mon retour' }).click();
  await expect(page.getByText('Merci, votre retour a été reçu.')).toBeVisible();
  expect(submitRequests).toBe(1);

  await page.getByRole('button', { name: 'Supprimer ce retour' }).click();
  await expect(page.getByRole('button', { name: 'Supprimer ce retour' })).toHaveCount(0);
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
