import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';
const entry=new URL('./check.mjs',import.meta.url);
function run(args=[],extra={}){return spawnSync(process.execPath,[entry.pathname,...args],{encoding:'utf8',env:{PATH:process.env.PATH,OPENAI_PAUSED:'true',BILLING_ENABLED:'false',...extra}});}
test('produit un diagnostic incomplet sans dossier, SDK ni fournisseur',()=>{
 const result=run();assert.equal(result.status,2);const report=JSON.parse(result.stdout);assert.equal(report.mode,'offline-diagnostic');assert.equal(report.canOpenCommercial,false);assert.ok(report.checks.some(check=>check.status==='missing'));
});
test('ne révèle jamais les valeurs privées du dossier ou des variables',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'mc-commercial-'));try{
  const path=join(folder,'private.json');await writeFile(path,JSON.stringify({publisher:{legalName:'IDENTITE-PRIVEE-A-MASQUER',contactEmail:'prive@example.test'}}),{mode:0o600});
  const result=run(['--dossier',path],{STRIPE_SECRET_KEY:'sk_live_SECRET_INTERDIT',STRIPE_WEBHOOK_SECRET:'whsec_SECRET_INTERDIT'});
  assert.equal(result.status,2);assert.ok(!result.stdout.includes('IDENTITE-PRIVEE'));assert.ok(!result.stdout.includes('prive@example.test'));assert.ok(!result.stdout.includes('SECRET_INTERDIT'));
  const report=JSON.parse(result.stdout);assert.equal(report.checks.find(x=>x.field==='publisher.legalName').status,'present');assert.equal(report.canOpenCommercial,false);
 }finally{await rm(folder,{recursive:true,force:true});}
});
test('refuse JSON invalide, valeurs non textuelles et fichier volumineux sans les recopier',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'mc-commercial-'));try{
  const path=join(folder,'private.json');
  for(const content of ['{"secret":"NE-PAS-RECOPIER"',JSON.stringify({publisher:{legalName:42}}),' '.repeat(32769)]){
   await writeFile(path,content);const result=run(['--dossier',path]);assert.equal(result.status,1);assert.equal(result.stdout,'');assert.ok(!result.stderr.includes('NE-PAS-RECOPIER'));assert.ok(!result.stderr.includes(folder));
  }
 }finally{await rm(folder,{recursive:true,force:true});}
});
test('aide et options inconnues restent explicites et ne lisent aucun dossier',()=>{
 assert.equal(run(['--help']).status,0);assert.equal(run(['--execute']).status,1);
});
test('un dossier renseigné reste une revue documentaire et ne permet aucun encaissement',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'mc-commercial-'));try{
  const {readFile}=await import('node:fs/promises');
  const dossier=JSON.parse(await readFile(new URL('../../docs/commercial-dossier.template.json',import.meta.url),'utf8'));
  for(const fields of Object.values(dossier))for(const key of Object.keys(fields))fields[key]=key==='contactEmail'?'fixture@example.test':key==='taxDisplay'?'ttc':'Référence fictive du test';
  const path=join(folder,'private.json');await writeFile(path,JSON.stringify(dossier));
  const result=run(['--dossier',path],{NEXT_PUBLIC_APP_URL:'https://mentioncheck.test',STRIPE_MODE:'test',STRIPE_SECRET_KEY:'sk_test_fixture',STRIPE_WEBHOOK_SECRET:'whsec_fixture',STRIPE_PRICE_SOLO:'price_SOLO',STRIPE_PRICE_PRO:'price_PRO',STRIPE_PRICE_STUDIO:'price_STUDIO'});
  assert.equal(result.status,0);const report=JSON.parse(result.stdout);assert.equal(report.readyForReview,true);assert.equal(report.canOpenCommercial,false);assert.equal(report.capabilities.billing,'disabled');
 }finally{await rm(folder,{recursive:true,force:true});}
});
