import { test, expect } from '@playwright/test';
import { checkInputSchema, type AnalysisResult } from '../../lib/ai/schemas';
import { applyRules, levelFromRisk, riskFrom } from '../../lib/ai/rules';
// Opt-in seulement : l'envoi utilise explicitement rules_only, jamais GPT-4o.
const email = process.env.E2E_TEST_EMAIL;
const password = process.env.E2E_TEST_PASSWORD;
test.skip(!email || !password, 'Compte de test non configuré.');
test('contrôle gratuit sans appel OpenAI', async ({ page, baseURL }) => {
  if (process.env.E2E_OFFLINE_AUTH === '1') {
    // Seule la frontière HTTP de persistance est simulée : les règles viennent
    // du moteur existant, le formulaire et le lecteur SSE restent ceux du site.
    await page.route('**/*', async (route) => {
      if (new URL(route.request().url()).origin !== new URL(baseURL!).origin)
        throw new Error('Requête externe interdite pendant le contrôle hors ligne.');
      await route.continue();
    });
    await page.route('**/api/check', async (route) => {
      const input = checkInputSchema.parse(route.request().postDataJSON());
      expect(input.execution).toBe('rules_only');
      expect(input.mediaType).toBe('none');
      const violations = applyRules(input.caption, input.platform);
      const risk = riskFrom(violations, 0);
      const result: AnalysisResult = {
        score: 100 - risk, riskLevel: levelFromRisk(risk), violations,
        aiFlags: [], rewrite: null, hashSha256: 'offline-fixture',
        verificationId: '33333333-3333-4333-8333-333333333333',
        analysisMode: 'rules_only', warnings: ['Contrôle hors ligne des règles automatiques.'],
      };
      await route.fulfill({ contentType: 'text/event-stream', body:
        'event: scan_text\ndata: {"status":"complete"}\n\n' +
        `event: scoring\ndata: ${JSON.stringify({ status: 'complete', score: result.score })}\n\n` +
        `event: done\ndata: ${JSON.stringify(result)}\n\n`,
      });
    });
  }
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
  if (process.env.E2E_OFFLINE_AUTH === '1') {
    await expect(page.getByText('R1 — Mention commerciale absente', { exact: true })).toBeVisible();
    await expect(page.getByText(/Le score ci-dessous est provisoire/)).toBeVisible();
  }
});
