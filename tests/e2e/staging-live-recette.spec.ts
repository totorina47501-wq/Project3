import {test,expect} from '@playwright/test';
const live=process.env.E2E_STAGING_ONLY==='1';
test.skip(!live,'Réservé à la recette réelle staging, comptes jetables uniquement');
const a={email:process.env.E2E_TEST_EMAIL,password:process.env.E2E_TEST_PASSWORD};
const b={email:process.env.E2E_TEST_EMAIL_B,password:process.env.E2E_TEST_PASSWORD_B};
const bId=process.env.E2E_B_ID;
const bVerificationId=process.env.E2E_B_VERIFICATION_ID;
async function login(page:import('@playwright/test').Page,actor:typeof a){
 if(!actor.email||!actor.password)throw Error('Identité staging non configurée');
 await page.goto('/login');
 await page.getByLabel('Adresse email').fill(actor.email);
 await page.getByLabel('Mot de passe').fill(actor.password);
 await page.getByRole('button',{name:'Se connecter'}).click();
 await expect(page).toHaveURL(/\/dashboard(?:\?|$)/,{timeout:30000});
}
test('sessions indépendantes, PDF B inaccessible à A, export RGPD privé',async({browser,baseURL})=>{
 expect(new URL(baseURL!).origin).toBe('https://mentioncheck-staging.toto-rina47501.workers.dev');
 const ctxA=await browser.newContext(),ctxB=await browser.newContext();
 try{
  await login(await ctxA.newPage(),a);
  await login(await ctxB.newPage(),b);
  expect((await ctxA.request.get('/api/mia/conversations')).status()).toBe(200);
  expect((await ctxB.request.get('/api/mia/conversations')).status()).toBe(200);
  expect((await ctxA.request.get('/api/archive/'+bVerificationId+'/pdf')).status()).toBe(404);
  const own=await ctxB.request.get('/api/archive/'+bVerificationId+'/pdf');
  expect(own.status()).toBe(200);
  expect((await own.body()).subarray(0,4).toString()).toBe('%PDF');
  const exportA=await ctxA.request.get('/api/account/export');
  const exportB=await ctxB.request.get('/api/account/export');
  expect(exportA.status()).toBe(200);
  expect(exportB.status()).toBe(200);
  expect(exportA.headers()['cache-control']).toContain('no-store');
  const payloadA=await exportA.json();
  expect(JSON.stringify(payloadA)).not.toContain(bId);
  expect(JSON.stringify(payloadA)).not.toContain(bVerificationId);
  console.log('STAGING_BROWSER_PDF_RGPD_EXPORT_PASS');
 }finally{await ctxA.close();await ctxB.close();}
});
test('CSRF authentifié et aperçu RGPD sans effacement',async({browser,baseURL})=>{
 const ctx=await browser.newContext();
 try{
  await login(await ctx.newPage(),a);
  const evil={Origin:'https://attacker.invalid'};
  expect((await ctx.request.post('/api/auth/logout',{headers:evil})).status()).toBe(403);
  expect((await ctx.request.post('/api/check',{headers:evil,
    data:{caption:'Test sans analyse',platform:'instagram',execution:'ai',mediaType:'none'}})).status()).toBe(403);
  expect((await ctx.request.post('/api/account/erasure',{headers:evil,
    data:{action:'request',confirmation:'SUPPRIMER'}})).status()).toBe(403);
  expect((await ctx.request.post('/api/account/consent',{headers:evil,
    data:{aiTrainingOptIn:true}})).status()).toBe(403);
  expect((await ctx.request.get('/api/mia/conversations')).status()).toBe(200);
  const origin={Origin:new URL(baseURL!).origin};
  const requested=await ctx.request.post('/api/account/erasure',{headers:origin,
    data:{action:'request',confirmation:'SUPPRIMER'}});
  expect(requested.status()).toBe(202);
  const preview=await ctx.request.post('/api/account/erasure',{headers:origin,data:{action:'preview'}});
  expect(preview.status()).toBe(200);
  const body=await preview.json();
  expect(body.plan.dryRun).toBe(true);
  expect(body.plan.deleted).toBe(false);
  const cancel=await ctx.request.post('/api/account/erasure',{headers:origin,data:{action:'cancel'}});
  expect(cancel.status()).toBe(200);
  const current=await ctx.request.get('/api/account/erasure');
  expect(current.status()).toBe(200);
  expect((await current.json()).request.status).toBe('cancelled');
  console.log('STAGING_BROWSER_CSRF_RGPD_PREVIEW_PASS');
 }finally{await ctx.close();}
});
test('navigation mobile sous vraie session',async({browser})=>{
 const ctx=await browser.newContext({viewport:{width:360,height:740}});
 try{
  const page=await ctx.newPage();
  await login(page,a);
  await page.goto('/dashboard');
  const nav=page.getByRole('navigation',{name:'Navigation mobile'});
  await expect(nav).toBeVisible();
  for(const name of ['Cockpit','Check','Mia','Médias','Archives']){
   const link=nav.getByRole('link',{name,exact:true});
   await expect(link).toBeVisible();
   const rect=await link.boundingBox();
   expect(rect?.width).toBeGreaterThanOrEqual(44);
   expect(rect?.height).toBeGreaterThanOrEqual(44);
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  console.log('STAGING_BROWSER_MOBILE_PASS');
 }finally{await ctx.close();}
});
