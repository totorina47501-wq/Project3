import { test, expect } from '@playwright/test';
test('Mia et les archives restent privées', async ({ page }) => {
  for (const path of ['/dashboard/mia', '/dashboard/archive', '/dashboard/media', '/dashboard/settings']) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login(?:\?|$)/);
    await expect(page.getByRole('heading', { name: 'Content de te retrouver !' })).toBeVisible();
  }
});
test('les endpoints privés rejettent un invité', async ({ request }) => {
  const history = await request.get('/api/mia/conversations');
  expect(history.status()).toBe(401);
  const chat = await request.post('/api/mia/chat', {
    data: { question: 'Quelles mentions pour une publicité ?' },
  });
  expect(chat.status()).toBe(401);
  const report = await request.get('/api/archive/33333333-3333-4333-8333-333333333333/pdf');
  expect(report.status()).toBe(401);
});

test('un visiteur ne peut ni lire ni déposer de demande d effacement',async({request})=>{
  const status=await request.get('/api/account/erasure');
  expect(status.status()).toBe(401);
  const create=await request.post('/api/account/erasure',{
    headers:{Origin: 'http://localhost:3000'},
    data:{action:'request',confirmation:'SUPPRIMER'},
  });
  // Les requêtes de test depuis une origine non fiable peuvent être rejetées
  // avant l'authentification; dans les deux cas, aucune donnée n'est créée.
  expect([401,403]).toContain(create.status());
});
