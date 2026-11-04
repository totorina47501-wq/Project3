import { test, expect } from '@playwright/test';
import { localScenario,useScenarioActor } from './fixtures/scenario';

test('Studio : invitation unique, historique privé, clé limitée et révocation réelle en SQL local', async ({ page, context, browser, request, baseURL }) => {
  const scenario=await localScenario(request);
  await useScenarioActor(context,baseURL!,scenario.actors.owner);
  await page.goto('/dashboard/studio');
  await page.getByLabel('Nom de l’équipe').fill('Studio navigateur');
  await page.getByRole('button',{name:'Créer l’espace',exact:true}).click();
  await expect(page.getByRole('heading',{name:/Membres · 1\/5/})).toBeVisible();
  await expect(page.getByText('Fixture privée',{exact:false})).toHaveCount(0);
  await page.getByLabel('Email invité',{exact:true}).fill(scenario.actors.member.email);
  await page.getByRole('button',{name:'Créer le jeton d’invitation'}).click();
  const secret=page.getByRole('region',{name:'Secret affiché une seule fois'}).locator('output');
  await expect(secret).toHaveText(/^mc_invite_[a-f0-9]{64}$/);
  const invitation=(await secret.textContent())!;
  const memberContext=await browser.newContext();
  try {
    await useScenarioActor(memberContext,baseURL!,scenario.actors.member);
    const member=await memberContext.newPage(); await member.goto(baseURL!+'/dashboard/studio');
    await member.getByLabel('Jeton d’invitation',{exact:true}).fill(invitation);
    await member.getByRole('button',{name:'Accepter l’invitation'}).click();
    await expect(member.getByRole('heading',{name:/Membres · 2\/5.*member/})).toBeVisible();
    await expect(member.getByRole('button',{name:'Créer une clé',exact:true})).toHaveCount(0);
    await member.getByLabel('Jeton d’invitation',{exact:true}).fill(invitation);
    await member.getByRole('button',{name:'Accepter l’invitation'}).click();
    await expect(member.getByRole('alert').filter({hasText:'Accès Studio refusé'})).toContainText('Accès Studio refusé');
  } finally { await memberContext.close(); }
  await page.getByRole('button',{name:'J’ai conservé le secret, fermer'}).click();
  await page.getByLabel('Nom de la clé',{exact:true}).fill('Lecture seule');
  await page.getByRole('button',{name:'Créer une clé',exact:true}).click();
  await expect(secret).toHaveText(/^mc_studio_[a-f0-9]{64}$/);
  const key=(await secret.textContent())!;
  const headers={authorization:'Bearer '+key};
  expect((await page.request.get('/api/v1/verifications',{headers})).status()).toBe(200);
  expect((await page.request.post('/api/v1/check',{headers,data:{caption:'PUBLICITÉ — Test',platform:'instagram'}})).status()).toBe(403);
  await page.getByRole('button',{name:'Révoquer Lecture seule',exact:true}).click();
  await expect(page.getByRole('region',{name:'Secret affiché une seule fois'})).toHaveCount(0);
  await expect.poll(async ()=>(await page.request.get('/api/v1/verifications',{headers})).status()).toBe(403);
});
