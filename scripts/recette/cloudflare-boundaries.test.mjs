// Tests négatifs des frontières Cloudflare : aucune API, aucun compte ni réseau.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const root=fileURLToPath(new URL('../../',import.meta.url));
const load=(name)=>JSON.parse(readFileSync(join(root,name),'utf8'));
const prodSource=load('wrangler.jsonc');
const stagingSource=load('wrangler.staging.jsonc');

function check(script,mutate=()=>{}){
  const cwd=mkdtempSync(join(tmpdir(),'mentioncheck-cloudflare-boundary-'));
  try{
    const prod=structuredClone(prodSource);
    const staging=structuredClone(stagingSource);
    mutate(prod,staging);
    writeFileSync(join(cwd,'wrangler.jsonc'),JSON.stringify(prod));
    writeFileSync(join(cwd,'wrangler.staging.jsonc'),JSON.stringify(staging));
    const result=spawnSync(process.execPath,[join(root,'scripts/recette',script)],{
      cwd,encoding:'utf8',timeout:5000,
    });
    if(result.error)throw result.error;
    return result;
  }finally{
    rmSync(cwd,{recursive:true,force:true});
  }
}

const staging='check-cloudflare-staging-boundary.mjs';
const preview='check-cloudflare-preview-boundary.mjs';

test('les deux configurations de référence passent les garde-fous',()=>{
  for(const script of [staging,preview]){
    const result=check(script);
    assert.equal(result.status,0,result.stderr);
  }
});

const refused=[
  ['staging refuse le projet Supabase de production',staging,(_prod,st)=>{
    st.vars.NEXT_PUBLIC_SUPABASE_URL='https://zcztvberuihphqklhjsr.supabase.co';
  }],
  ['staging refuse le partage du rate limiter production',staging,(prod,st)=>{
    st.ratelimits[0].namespace_id=prod.ratelimits[0].namespace_id;
  }],
  ['staging refuse une fonctionnalité IA active',staging,(_prod,st)=>{
    st.vars.OPENAI_VISION_ENABLED='true';
  }],
  ['staging refuse la clé service_role même avec un nom alternatif',staging,(_prod,st)=>{
    st.vars.SUPABASE_SERVICE_ROLE_KEY='fixture-sans-secret';
  }],
  ['Preview refuse la disparition de son isolation',preview,(prod)=>{
    delete prod.previews;
  }],
  ['Preview refuse un lien Supabase production',preview,(prod)=>{
    prod.previews.vars.NEXT_PUBLIC_SUPABASE_URL='https://zcztvberuihphqklhjsr.supabase.co';
  }],
  ['Preview refuse les appels IA actifs',preview,(prod)=>{
    prod.previews.vars.OPENAI_TEXT_ENABLED='true';
  }],
  ['Preview refuse les clés service_role',preview,(prod)=>{
    prod.previews.vars.SUPABASE_SERVICE_ROLE_KEY='fixture-sans-secret';
  }],
];
for(const [name,script,mutate] of refused){
  test(name,()=>{
    const result=check(script,mutate);
    assert.notEqual(result.status,0,'Une configuration non sûre ne doit pas passer : '+name);
  });
}

// Recette RGPD sur staging partage : verification hors reseau du garde-fou de fixture.
test('RGPD staging preserve les comptes OAuth preexistants et efface uniquement sa fixture marquee',()=>{
  const source=readFileSync(join(root,'scripts/recette/staging-rgpd-erasure.mjs'),'utf8');
  assert.doesNotMatch(source,/QA_STAGING_NOT_EMPTY_ABORT/);
  assert.match(source,/const run=randomUUID\(\)/);
  assert.match(source,/app_metadata:\{mentioncheck_erasure_qa:run\}/);
  assert.match(source,/assert\.equal\(u\.id,id\)/);
  assert.match(source,/assert\.equal\(u\.email,email\)/);
  assert.match(source,/assert\.equal\(u\.app_metadata\?\.mentioncheck_erasure_qa,run/);
  assert.match(source,/async function cleanup\(\)\{\s*await actorCheck\(\)/);
  assert.match(source,/admin\.auth\.admin\.deleteUser\(id\)/);
  assert.match(source,/\.eq\('id',id\)/);
});

// Les workflows staging partagent le même Worker : ne jamais perdre une recette en attente.
test('Auth et Studio staging sérialisent les déploiements sans annuler les runs en attente',()=>{
  for(const path of [
    '.github/workflows/mentioncheck-launch-staging-auth.yml',
    '.github/workflows/mentioncheck-studio-api-staging.yml',
  ]){
    const workflow=readFileSync(join(root,path),'utf8');
    assert.match(workflow,/concurrency:\\s*\\n\\s*group: mentioncheck-staging-cloudflare\\s*\\n\\s*queue: max\\s*\\n\\s*cancel-in-progress: false/);
    assert.match(workflow,/BILLING_ENABLED: 'false'/);
    assert.match(workflow,/OPENAI_PAUSED: 'true'/);
  }
});
