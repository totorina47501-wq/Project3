import { test, expect } from '@playwright/test';

// Ces tests utilisent les vrais formulaires, avec la seule frontière HTTP simulée.
// Aucune requête du navigateur vers un service externe n'est autorisée.
test.beforeEach(async ({ page, baseURL }) => {
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === new URL(baseURL!).origin) return route.continue();
    throw new Error(`Requête externe interdite dans ce test : ${url.origin}`);
  });
});

test('erreur de connexion accessible au clavier, sans perte des champs', async ({ page }) => {
  let requests = 0;
  await page.route('**/api/auth/login', async (route) => {
    requests += 1;
    await route.fulfill({ status: 401, json: { error: 'Identifiants invalides.' } });
  });
  await page.goto('/login');
  await page.getByLabel('Adresse email').fill('test@example.invalid');
  await page.getByLabel('Mot de passe').fill('mot-de-passe-fictif');
  await page.getByLabel('Mot de passe').press('Enter');
  await expect(page.getByRole('main').getByRole('alert')).toHaveText('Identifiants invalides.');
  await expect(page.getByLabel('Adresse email')).toHaveValue('test@example.invalid');
  await expect(page.getByRole('button', { name: 'Se connecter' })).toBeEnabled();
  expect(requests).toBe(1);
});

test('inscription mobile : attente annoncée et confirmation sans redirection privée', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => { finish = resolve; });
  await page.route('**/api/auth/register', async (route) => {
    await pending;
    await route.fulfill({ json: { message: 'Vérifie tes emails pour activer le compte.' } });
  });
  await page.goto('/register');
  await page.getByLabel('Adresse email').fill('test@example.invalid');
  await page.getByLabel('Mot de passe').fill('mot-de-passe-fictif');
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  await expect(page.getByRole('button', { name: 'Création en cours…' })).toBeDisabled();
  await expect(page.getByLabel('Adresse email')).toBeDisabled();
  finish();
  await expect(page.getByRole('status')).toContainText('Vérifie tes emails');
  await expect(page).toHaveURL(/\/register$/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('une réponse non JSON affiche une erreur utile et permet de réessayer', async ({ page }) => {
  await page.route('**/api/auth/login', async (route) => {
    await route.fulfill({ status: 503, contentType: 'text/html', body: '<h1>Indisponible</h1>' });
  });
  await page.goto('/login');
  await page.getByLabel('Adresse email').fill('test@example.invalid');
  await page.getByLabel('Mot de passe').fill('mot-de-passe-fictif');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toHaveText('Le service est momentanément indisponible. Réessaie dans un instant.');
  await expect(page.getByRole('button', { name: 'Se connecter' })).toBeEnabled();
});
