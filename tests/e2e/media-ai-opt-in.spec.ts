import { test, expect } from '@playwright/test';

// Frontières HTTP interceptées : aucun média, appel OpenAI ni donnée réelle.
test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL)
  || process.env.MEDIA_PROCESSING_ENABLED !== 'true'
  || process.env.MEDIA_JOBS_SCHEMA_READY !== 'true',
'Scénario local : activer uniquement les flags de préparation média du serveur E2E.');

test('Mia média : clic explicite, audio choisi, suivi GET et résultat retrouvé sans nouvel appel', async ({ page }) => {
  const jobId = '11111111-1111-4111-8111-111111111111';
  const verificationId = '22222222-2222-4222-8222-222222222222';
  let posts = 0, reads = 0, completed = false;
  await page.route(/\/api\/media\/library(?:\?.*)?$/, route => route.fulfill({ json: { items: [] } }));
  await page.route(/\/api\/media\/jobs(?:\?.*)?$/, route => route.fulfill({ json: {
    jobs: [{ id: jobId, verification_id: '33333333-3333-4333-8333-333333333333',
      kind: 'video', status: 'completed', attempts: 1, failure_code: null }], total: 1,
  } }));
  await page.route('**/api/media/jobs/' + jobId + '/analyze', async route => {
    if (route.request().method() === 'POST') {
      posts++;
      expect(route.request().postDataJSON()).toEqual({ includeAudio: true });
      await route.fulfill({ status: 202, json: { status: 'processing', verificationId } });
    } else {
      reads++;
      await route.fulfill({ json: { runs: posts ? [{ id: 'run', include_audio: true,
        status: completed ? 'completed' : 'processing', verification_id: verificationId,
        created_at: '2026-11-05T12:00:00Z', completed_at: completed ? '2026-11-05T12:01:00Z' : null,
      }] : [] } });
    }
  });
  await page.goto('/login');
  await page.getByLabel('Adresse email').fill(process.env.E2E_TEST_EMAIL!);
  await page.getByLabel('Mot de passe').fill(process.env.E2E_TEST_PASSWORD!);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL(/\/dashboard(?:\?|$)/);
  await page.goto('/dashboard/media');
  const analyze = page.getByRole('button', { name: 'Analyser avec Mia', exact: true });
  const audio = page.getByLabel('Inclure la transcription audio');
  await expect(analyze).toBeEnabled();
  await expect(audio).not.toBeChecked();
  expect(posts).toBe(0);
  await audio.check();
  await analyze.click();
  await expect(page.getByText('Analyse IA en cours.', { exact: false })).toBeVisible();
  await expect(analyze).toBeDisabled();
  expect(posts).toBe(1);
  completed = true;
  const result = page.getByRole('link', { name: 'Consulter le résultat IA', exact: true });
  await expect(result).toHaveAttribute('href', '/dashboard/archive/' + verificationId, { timeout: 12_000 });
  expect(posts).toBe(1);
  await page.reload();
  await page.getByRole('button', { name: 'Consulter les analyses IA', exact: true }).click();
  await expect(result).toBeVisible();
  expect(reads).toBeGreaterThanOrEqual(2);
  expect(posts).toBe(1);
});
