import { test, expect } from '@playwright/test';
import { localScenario,useScenarioActor } from './fixtures/scenario';
test('collaboration : brouillon, archive immuable, exports et isolation des comptes sur SQL local', async ({page,context,request,browser,baseURL})=>{
  const scenario=await localScenario(request);
  await useScenarioActor(context,baseURL!,scenario.actors.owner);
  await page.goto('/dashboard/brand-deals');
  await page.getByLabel('Marque',{exact:true}).fill('Marque navigateur');
  await page.getByLabel('Date de début',{exact:true}).fill('2026-11-01');
  await page.getByLabel('Identifiants de tes vérifications',{exact:false}).fill(scenario.verificationIds.owner);
  await page.getByRole('button',{name:'Enregistrer le brouillon',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Marque navigateur',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Archiver Marque navigateur',exact:true}).click();
  await page.getByRole('alertdialog').getByRole('button',{name:'Confirmer',exact:true}).click();
  await expect(page.getByText(/^SHA-256 : [a-f0-9]{64}$/)).toBeVisible();
  await expect(page.getByRole('button',{name:'Modifier Marque navigateur',exact:true})).toHaveCount(0);
  const exported=await page.request.get('/api/brand-deals/export?format=json&state=archived');
  expect(exported.status()).toBe(200);
  const data=await exported.json(); expect(data.complete).toBe(true); expect(data.certified).toBe(false);
  expect(data.items).toHaveLength(1); const id=data.items[0].id as string;
  const detail=await page.request.get('/api/brand-deals/'+id);
  expect(detail.status()).toBe(200); expect((await detail.json()).item.archive_payload).toBeTruthy();
  const pdf=await page.request.get('/api/brand-deals/export?format=pdf&state=archived');
  expect(pdf.status()).toBe(200); expect((await pdf.body()).subarray(0,4).toString()).toBe('%PDF');
  const csv=await page.request.get('/api/brand-deals/export?format=csv&state=archived');
  expect(csv.status()).toBe(200); expect(await csv.text()).toContain('Marque navigateur');
  const outsider=await browser.newContext();
  try {
    await useScenarioActor(outsider,baseURL!,scenario.actors.outsider);
    expect((await outsider.request.get(baseURL!+'/api/brand-deals/'+id)).status()).toBe(404);
    const listing=await outsider.request.get(baseURL!+'/api/brand-deals');
    expect((await listing.json()).items).toEqual([]);
  }finally{await outsider.close();}
});
