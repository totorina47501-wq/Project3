import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,writeFile,readFile,stat,rm,access } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { exportDataset } from './export.mjs';
import { revokeDataset } from './revoke.mjs';
const key=Buffer.alloc(32,7);
function row(index,user='creator-'+index) {return {
  id:'feedback-'+index,user_id:user,original_caption:'Produit '+index,
  accepted_caption:'PUBLICITÉ — Produit '+index,prompt_version:'v1',accepted_at:'2026-10-15T12:00:00Z',
  training_consent_snapshot:true,current_training_consent:true,erasure_requested:false,review_approved:true,
};}
async function fixture(run) {
  const dir=await mkdtemp(join(tmpdir(),'mentioncheck-revoke-'));
  try {
    const paths={dir,input:join(dir,'lot.json'),key:join(dir,'key.bin'),source:join(dir,'source'),revoked:join(dir,'revoked.json'),output:join(dir,'output')};
    await writeFile(paths.key,key,{mode:0o600});
    await writeFile(paths.input,JSON.stringify({captured_at:new Date().toISOString(),rows:[row(1,'creator-a'),row(2,'creator-a'),row(3,'creator-b'),row(4,'creator-c')]}),{mode:0o600});
    await exportDataset([paths.input,'2026-Q4',paths.key,paths.source]);
    await writeFile(paths.revoked,JSON.stringify({captured_at:new Date().toISOString(),review_approved:true,user_ids:['creator-a'],feedback_ids:['feedback-3']}),{mode:0o600});
    await run(paths);
  }finally {await rm(dir,{recursive:true,force:true});}
}
const invoke=paths=>revokeDataset([paths.source,paths.revoked,paths.key,paths.output]);
test('retire via HMAC utilisateur et feedback, conserve original et impose nouvelle relecture',()=>fixture(async paths=>{
  const before=await readFile(join(paths.source,'manifest.json'),'utf8');
  const report=await invoke(paths);
  assert.equal(report.accepted,1);assert.equal(report.revocation.removed,3);
  assert.equal(report.requiresFinalHumanReview,true);assert.equal(report.trainingStarted,false);
  const manifest=JSON.parse(await readFile(join(paths.output,'manifest.json'),'utf8'));
  assert.deepEqual(manifest.entries.map(item=>item.line),[1]);
  assert.equal((await stat(paths.output)).mode&0o777,0o700);
  assert.equal(await readFile(join(paths.source,'manifest.json'),'utf8'),before);
  for(const split of ['train','validation']) {
    const content=await readFile(join(paths.output,split+'.jsonl'),'utf8');
    assert.ok(!content.includes('Produit 1')&&!content.includes('Produit 2')&&!content.includes('Produit 3'));
    assert.equal(createHash('sha256').update(content).digest('hex'),report.sha256[split+'.jsonl']);
    assert.equal((await stat(join(paths.output,split+'.jsonl'))).mode&0o777,0o600);
  }
  assert.ok(!JSON.stringify(report).includes('creator-a'));
  await assert.rejects(invoke(paths));
}));
test('refuse une mauvaise clé sans créer de sortie',()=>fixture(async paths=>{
  await writeFile(paths.key,Buffer.alloc(32,8),{mode:0o600});
  await assert.rejects(invoke(paths));await assert.rejects(access(paths.output));
}));
for(const file of ['train.jsonl','manifest.json','report.json']) {
  test('refuse une modification de '+file+' avant tout retrait',()=>fixture(async paths=>{
    const path=join(paths.source,file),content=await readFile(path,'utf8');
    await writeFile(path,content+' ',{mode:0o600});
    // Les espaces de fin sur report.json ne changent pas son contenu signé : altérer une valeur.
    if(file==='report.json')await writeFile(path,content.replace('"accepted": 4','"accepted": 3'),{mode:0o600});
    await assert.rejects(invoke(paths));await assert.rejects(access(paths.output));
  }));
}
test('refuse liste périmée, sans relecture ou données insuffisantes',()=>fixture(async paths=>{
  for(const override of [{captured_at:'2020-01-01'},{review_approved:false},{user_ids:[],feedback_ids:[]}]) {
    await writeFile(paths.revoked,JSON.stringify({captured_at:new Date().toISOString(),review_approved:true,user_ids:['creator-a'],feedback_ids:[],...override}),{mode:0o600});
    await assert.rejects(invoke(paths));await assert.rejects(access(paths.output));
  }
}));
test('peut retirer toutes les lignes sans inventer un entraînement ou réautoriser les anciennes',()=>fixture(async paths=>{
  await writeFile(paths.revoked,JSON.stringify({captured_at:new Date().toISOString(),review_approved:true,user_ids:['creator-a','creator-b','creator-c'],feedback_ids:[]}),{mode:0o600});
  const report=await invoke(paths);
  assert.equal(report.accepted,0);assert.equal(report.trainingStarted,false);
  assert.equal(await readFile(join(paths.output,'train.jsonl'),'utf8'),'');
  assert.equal(await readFile(join(paths.output,'validation.jsonl'),'utf8'),'');
}));
