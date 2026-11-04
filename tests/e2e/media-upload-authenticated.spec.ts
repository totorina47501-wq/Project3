import { test, expect } from '@playwright/test';

// Opt-in explicite : upload réel vers Supabase, jamais OpenAI.
// Utiliser uniquement un compte de test dédié, jamais un compte client.
const enabled = process.env.E2E_MEDIA_UPLOAD_ENABLED === 'true'
  && !!process.env.E2E_TEST_EMAIL && !!process.env.E2E_TEST_PASSWORD;
test.skip(!enabled, 'Upload E2E désactivé : définir E2E_MEDIA_UPLOAD_ENABLED=true et un compte de test.');

test('carrousel privé : deux fichiers transférés puis supprimés', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Adresse email').fill(process.env.E2E_TEST_EMAIL!);
  await page.getByLabel('Mot de passe').fill(process.env.E2E_TEST_PASSWORD!);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto('/dashboard/media');
  await page.getByRole('button', { name: 'Carrousel' }).click();

  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==', 'base64');
  const created: string[] = [];
  page.on('response', async response => {
    if (response.url().includes('/api/media/prepare') && response.ok()) {
      const body = await response.json().catch(() => null);
      if (body?.assetId) created.push(body.assetId);
    }
  });
  try {
    await page.locator('#media-preparation-file').setInputFiles([
      { name: 'test-a.png', mimeType: 'image/png', buffer: png },
      { name: 'test-b.png', mimeType: 'image/png', buffer: png },
    ]);
    await expect(page.getByText('Carrousel privé enregistré.')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(/Transféré/).first()).toBeVisible();
    expect(created).toHaveLength(2);
  } finally {
    // Nettoyage limité aux médias créés pendant ce test, même en cas d'échec.
    for (const assetId of created) {
      await page.request.post('/api/media/remove', {
        data: { assetId }, headers: { origin: new URL(page.url()).origin },
      }).catch(() => {});
    }
  }
});
