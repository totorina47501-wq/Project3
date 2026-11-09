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
