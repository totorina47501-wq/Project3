import { test, expect } from '@playwright/test';
import { useLocalSession } from './fixtures/local-session';

// Opt-in uniquement au serveur Supabase HTTP local de la suite hors ligne.
// Ce cookie factice n'est accepté par aucun service de production.
test.skip(process.env.E2E_OFFLINE_AUTH !== '1', 'Nécessite la fixture Supabase HTTP locale.');

test.beforeEach(async ({ page, context, baseURL }) => {
  await useLocalSession(context, baseURL!);
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === new URL(baseURL!).origin) return route.continue();
    throw new Error(`Requête externe interdite : ${url.origin}`);
  });
});

function result(mode: 'rules_only' | 'partial' = 'rules_only') {
  return { score: 90, riskLevel: 'low', violations: [], aiFlags: [], rewrite: null,
    hashSha256: 'offline', verificationId: '33333333-3333-4333-8333-333333333333',
    analysisMode: mode, warnings: mode === 'rules_only' ? [] : ['Visuel indisponible.'] };
}

function events(value: ReturnType<typeof result>) {
  return `event: scan_text\ndata: {"status":"complete"}\n\nevent: scoring\ndata: {"status":"complete"}\n\nevent: done\ndata: ${JSON.stringify(value)}\n\n`;
}

async function mockCheckChunks(page: import('@playwright/test').Page, responses: string[][]) {
  await page.addInitScript((attempts) => {
    const originalFetch = window.fetch.bind(window);
    let checkAttempt = 0;
    window.fetch = async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input), window.location.href);
      if (url.pathname !== '/api/check') return originalFetch(input, init);
      const chunks = attempts[Math.min(checkAttempt++, attempts.length - 1)] ?? [];
      const body = new ReadableStream({
        start(controller) {
          for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk));
          controller.close();
        },
      });
      return new Response(body, { headers: { 'Content-Type': 'text/event-stream' } });
    };
  }, responses);
}

test('le check mobile choisit sans IA et explique le score provisoire', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  let submitted: Record<string, unknown> | undefined;
  await page.route('**/api/check', async (route) => {
    submitted = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({ contentType: 'text/event-stream', body: events(result()) });
  });
  await page.goto('/dashboard/check');
  await expect(page.getByRole('radio', { name: /Sans IA, sans crédit/ })).toBeChecked();
  await page.getByLabel('Légende sponsorisée').fill('Publicité — Une légende de test.');
  await page.getByRole('button', { name: 'Vérifier sans IA' }).click();
  await expect(page.getByRole('heading', { name: 'Contrôle automatique des mentions terminé' })).toBeVisible();
  await expect(page.getByText('Le score ci-dessous est provisoire', { exact: false })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Étapes du contrôle' })).toBeVisible();
  expect(submitted?.execution).toBe('rules_only');
  expect(submitted?.mediaType).toBe('none');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('le flux Check accepte CRLF, chunks fractionnés et un done final à EOF', async ({ page }) => {
  const finalEvent = `event: done\r\ndata: ${JSON.stringify(result())}`;
  const doneDataPrefix = 'event: done\r\ndata: ';
  await mockCheckChunks(page, [[
    'event: scan_text\r',
    '\ndata: {"status":"complete"}\r\n\r\nevent: scoring\r\ndata: {"status":"complete"}\r\n\r\n',
    doneDataPrefix,
    finalEvent.slice(doneDataPrefix.length),
  ]]);
  await page.goto('/dashboard/check');
  await page.getByLabel('Légende sponsorisée').fill('Ma légende fictive.');
  await page.getByRole('button', { name: 'Vérifier sans IA' }).click();
  await expect(page.getByRole('heading', { name: 'Contrôle automatique des mentions terminé' })).toBeVisible();
  await expect(page.getByText('Analyse du texte')).toBeVisible();
  await expect(page.getByText('Calcul du score')).toBeVisible();
  expect(finalEvent).not.toContain('\r\n\r\n');
});

test('un événement malformé est masqué et une nouvelle tentative peut réussir', async ({ page }) => {
  await mockCheckChunks(page, [
    ['event: done\ndata: {"score":90,"internal":"private'],
    [events(result())],
  ]);
  await page.goto('/dashboard/check');
  await page.getByLabel('Légende sponsorisée').fill('Ma légende fictive.');
  await page.getByRole('button', { name: 'Vérifier sans IA' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toHaveText('Le flux de vérification est invalide.');
  await expect(page.getByText('Score de conformité estimé')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Vérifier sans IA' })).toBeEnabled();
  await page.getByRole('button', { name: 'Vérifier sans IA' }).click();
  await expect(page.getByRole('heading', { name: 'Contrôle automatique des mentions terminé' })).toBeVisible();
});

test('un repli après erreur IA ne prétend pas être un choix sans IA', async ({ page }) => {
  await page.route('**/api/check', async (route) => {
    await route.fulfill({ contentType: 'text/event-stream', body: events(result()) });
  });
  await page.goto('/dashboard/check');
  await page.getByRole('radio', { name: /Analyse avec Mia/ }).check();
  await page.getByLabel('Légende sponsorisée').fill('Ma légende fictive.');
  await page.getByRole('button', { name: 'Analyser avec Mia (crédits IA)' }).click();
  await expect(page.getByText('Analyse partielle : une fonction IA est indisponible')).toBeVisible();
  await expect(page.getByText(/volontairement sélectionné/)).toHaveCount(0);
});

test('un flux interrompu rend le formulaire utilisable sans afficher de score', async ({ page }) => {
  let attempts = 0;
  await page.route('**/api/check', async (route) => {
    attempts += 1;
    await route.fulfill({ contentType: 'text/event-stream', body: attempts === 1
      ? 'event: scan_text\ndata: {"status":"running"}\n\n'
      : events(result()) });
  });
  await page.goto('/dashboard/check');
  await page.getByLabel('Légende sponsorisée').fill('Ma légende fictive.');
  await page.getByRole('button', { name: 'Vérifier sans IA' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('interrompu');
  await expect(page.getByRole('button', { name: 'Vérifier sans IA' })).toBeEnabled();
  await expect(page.getByText('Score de conformité estimé')).toHaveCount(0);
  await page.getByRole('button', { name: 'Vérifier sans IA' }).click();
  await expect(page.getByRole('heading', { name: 'Contrôle automatique des mentions terminé' })).toBeVisible();
});

test('arrêter l’attente du check restaure les contrôles', async ({ page }) => {
  let started!: () => void;
  const requested = new Promise<void>((resolve) => { started = resolve; });
  await page.route('**/api/check', async () => { started(); });
  await page.goto('/dashboard/check');
  await page.getByLabel('Légende sponsorisée').fill('Ma légende fictive.');
  await page.getByRole('button', { name: 'Vérifier sans IA' }).click();
  await requested;
  await expect(page.getByLabel('Légende sponsorisée')).toBeDisabled();
  await page.getByRole('button', { name: 'Arrêter l’attente' }).click();
  await expect(page.getByRole('button', { name: 'Vérifier sans IA' })).toBeEnabled();
  await expect(page.getByLabel('Légende sponsorisée')).toHaveValue('Ma légende fictive.');
});

test('Mia distingue historique indisponible et vide puis permet une nouvelle tentative', async ({ page }) => {
  let attempts = 0;
  await page.route('**/api/mia/conversations', async (route) => {
    attempts += 1;
    await route.fulfill(attempts === 1 ? { status: 503, json: { error: 'Historique indisponible.' } }
      : { json: { conversations: [] } });
  });
  await page.goto('/dashboard/mia');
  await expect(page.getByText('Impossible de charger l’historique des discussions.')).toBeVisible();
  await expect(page.getByText('Tes prochaines discussions apparaîtront ici.')).toHaveCount(0);
  await page.getByRole('button', { name: 'Réessayer l’historique' }).click();
  await expect(page.getByText('Tes prochaines discussions apparaîtront ici.')).toBeVisible();
});

test('Mia conserve la question après une erreur puis affiche réponse et sources', async ({ page }) => {
  await page.route('**/api/mia/conversations', async (route) => route.fulfill({ json: { conversations: [] } }));
  let attempts = 0;
  await page.route('**/api/mia/chat', async (route) => {
    attempts += 1;
    await route.fulfill(attempts === 1 ? { status: 503, json: { error: 'Mia indisponible.' } }
      : { json: { conversationId: '22222222-2222-4222-8222-222222222222',
        answer: 'La mention doit être visible immédiatement.',
        sources: [{ articleRef: 'Loi du 9 juin 2023', sourceUrl: 'https://www.legifrance.gouv.fr/' }] } });
  });
  await page.goto('/dashboard/mia');
  await page.getByLabel('Ta question').fill('Comment déclarer une publicité ?');
  await page.getByRole('button', { name: 'Envoyer à Mia' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toHaveText('Mia indisponible.');
  await expect(page.getByLabel('Ta question')).toHaveValue('Comment déclarer une publicité ?');
  await page.getByRole('button', { name: 'Envoyer à Mia' }).click();
  await expect(page.getByText('La mention doit être visible immédiatement.')).toBeVisible();
  await expect(page.getByRole('link', { name: /Loi du 9 juin 2023/ })).toHaveAttribute('rel', 'noopener noreferrer');
});

test('arrêter l’attente de Mia conserve le brouillon', async ({ page }) => {
  await page.route('**/api/mia/conversations', async (route) => route.fulfill({ json: { conversations: [] } }));
  await page.route('**/api/mia/chat', async () => {});
  await page.goto('/dashboard/mia');
  await page.getByLabel('Ta question').fill('Comment déclarer une publicité ?');
  await page.getByRole('button', { name: 'Envoyer à Mia' }).click();
  await expect(page.getByLabel('Ta question')).toBeDisabled();
  await page.getByRole('button', { name: 'Arrêter l’attente' }).click();
  await expect(page.getByLabel('Ta question')).toHaveValue('Comment déclarer une publicité ?');
  await expect(page.getByRole('button', { name: 'Envoyer à Mia' })).toBeEnabled();
});


test('Mia isole les brouillons entre deux discussions et une nouvelle discussion', async ({ page }) => {
  const conversations = [
    { id: '11111111-1111-4111-8111-111111111111', verificationId: null,
      updatedAt: '2026-11-08T10:00:00.000Z',
      messages: [{ role: 'user', content: 'Question Alpha sur publicité' },
        { role: 'assistant', content: 'Réponse Alpha.' }] },
    { id: '22222222-2222-4222-8222-222222222222', verificationId: null,
      updatedAt: '2026-11-08T11:00:00.000Z',
      messages: [{ role: 'user', content: 'Question Beta sur partenariat' },
        { role: 'assistant', content: 'Réponse Beta.' }] },
  ];
  await page.route('**/api/mia/conversations', async route =>
    route.fulfill({ json: { conversations } }));
  await page.goto('/dashboard/mia');
  const input = page.getByLabel('Ta question');
  await page.getByRole('button', { name: /Question Alpha sur publicité/ }).click();
  await input.fill('Mon brouillon Alpha');
  await page.getByRole('button', { name: /Question Beta sur partenariat/ }).click();
  await expect(input).toHaveValue('');
  await input.fill('Mon brouillon Beta');
  await page.getByRole('button', { name: /Question Alpha sur publicité/ }).click();
  await expect(input).toHaveValue('Mon brouillon Alpha');
  await page.getByRole('button', { name: 'Nouvelle discussion' }).click();
  await expect(input).toHaveValue('');
  await input.fill('Mon brouillon sans discussion');
  await page.getByRole('button', { name: /Question Beta sur partenariat/ }).click();
  await expect(input).toHaveValue('Mon brouillon Beta');
  await page.getByRole('button', { name: 'Nouvelle discussion' }).click();
  await expect(input).toHaveValue('Mon brouillon sans discussion');
});

test('une suggestion Mia remplit le brouillon et redonne le focus au champ', async ({ page }) => {
  await page.route('**/api/mia/conversations', async route =>
    route.fulfill({ json: { conversations: [] } }));
  await page.goto('/dashboard/mia');
  await page.getByRole('button', { name: 'Comment signaler un partenariat rémunéré ?' }).click();
  await expect(page.getByLabel('Ta question')).toHaveValue('Comment signaler un partenariat rémunéré ?');
  await expect(page.getByLabel('Ta question')).toBeFocused();
  await page.getByRole('button', { name: 'Nouvelle discussion' }).click();
  await expect(page.getByLabel('Ta question')).toHaveValue('');
});
