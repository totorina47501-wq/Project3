// Reelle recette rollback de DEUX versions de code, uniquement mentioncheck-staging.
// Restaure toujours le deploiement initial, y compris sur echec de validation.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const name='mentioncheck-staging', account='f9b14d5d93b1fe8ef3982d3ddb87131d';
const site='https://mentioncheck-staging.toto-rina47501.workers.dev';
const db='https://ukvgnkxgzyhswgpnvyzz.supabase.co';
assert.equal(process.env.GITHUB_REPOSITORY,'totorina47501-wq/Project3');
assert.equal(process.env.GITHUB_REF,'refs/heads/codex/codex-certification-six-chantiers');
assert.equal(process.env.CLOUDFLARE_ACCOUNT_ID,account);
assert.equal(process.env.NEXT_PUBLIC_APP_URL,site);
assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL,db);
for(const [key,value] of Object.entries({
 OPENAI_PAUSED:'true',OPENAI_TEXT_ENABLED:'false',OPENAI_VISION_ENABLED:'false',
 OPENAI_AUDIO_ENABLED:'false',OPENAI_EMBEDDINGS_ENABLED:'false',
 BILLING_ENABLED:'false',PROMO_SOLO_ENABLED:'false',
 MEDIA_AI_ENABLED:'false',MEDIA_PROCESSING_ENABLED:'false',
 MEDIA_RETENTION_ENABLED:'false',MEDIA_CLOUDFLARE_RUNNER_ENABLED:'false'
}))assert.equal(process.env[key],value,'Staging gate '+key);
assert.ok(process.env.CLOUDFLARE_API_TOKEN&&process.env.SUPABASE_SERVICE_KEY&&
 process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,'Staging secrets missing');
const root=process.cwd();
function command(bin,args,cwd=root,label=bin){
 try {return execFileSync(bin,args,{cwd,env:process.env,encoding:'utf8',
    stdio:['ignore','pipe','pipe'],timeout:480000,maxBuffer:30000000}).trim();}
 catch(error){throw Error('STAGING_STEP_FAILED_'+label+'_'+(error.status??'timeout'));}
}
const git=(args,cwd=root)=>command('git',args,cwd,'git');
const aSha=git(['rev-parse','HEAD']);
const bSha=git(['rev-parse','refs/remotes/origin/main']);
assert.equal(aSha,process.env.GITHUB_SHA);
assert.match(aSha,/^[a-f0-9]{40}$/);assert.match(bSha,/^[a-f0-9]{40}$/);
assert.notEqual(aSha,bSha,'Two code commits required');
let different=false;
try{execFileSync('git',['diff','--quiet',aSha,bSha,'--','app','lib'],{cwd:root,stdio:'ignore'});}
catch(error){if(error.status===1)different=true;else throw Error('DIFF_FAILED');}
assert.ok(different,'Identical application code not allowed');
const prefix='https://api.cloudflare.com/client/v4/accounts/'+account+'/workers/scripts/'+name;
async function api(path){
 const resp=await fetch(prefix+path,{headers:{Authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN},
  signal:AbortSignal.timeout(20000)});
 if(!resp.ok)throw Error('CLOUDFLARE_READ_HTTP_'+resp.status);
 const json=await resp.json();
 if(!json.success)throw Error('CLOUDFLARE_READ_FAILED');
 return json.result;
}
async function active(){
 const rows=(await api('/deployments'))?.deployments;
 assert.ok(Array.isArray(rows)&&rows.length);
 const v=rows[0]?.versions??[];
 assert.equal(v.length,1,'Split traffic is forbidden');
 assert.equal(v[0]?.percentage,100);
 assert.match(v[0]?.version_id??'',/^[a-f0-9-]{36}$/);
 return v[0].version_id;
}
async function hasSecrets(version){
 const obj=await api('/versions/'+version);
 const bindings=obj?.resources?.bindings;
 const names=(Array.isArray(bindings)?bindings:Object.values(bindings??{}))
  .filter(x=>x?.type==='secret_text').map(x=>x.name);
 return ['NEXT_PUBLIC_SUPABASE_ANON_KEY','SUPABASE_SERVICE_KEY'].every(x=>names.includes(x));
}
async function smoke(phase){
 for(const [path,expected] of [['/login',[200]],['/api/mia/conversations',[401,403]],['/api/account/export',[401,403]]]){
  const response=await fetch(site+path,{signal:AbortSignal.timeout(20000)});
  assert.ok(expected.includes(response.status),'Staging smoke '+phase+' path='+path+' status='+response.status);
 }
 console.log('STAGING_CODE_SMOKE_PASS_'+phase);
}
function safeConfig(dir){
 const c=JSON.parse(readFileSync(join(dir,'wrangler.staging.jsonc'),'utf8'));
 assert.equal(c.name,name);
 assert.equal(c.workers_dev,true);
 assert.equal(c.vars.NEXT_PUBLIC_APP_URL,site);
 assert.equal(c.vars.NEXT_PUBLIC_SUPABASE_URL,db);
 for(const [key,value] of Object.entries({OPENAI_PAUSED:'true',BILLING_ENABLED:'false',
   PROMO_SOLO_ENABLED:'false',MEDIA_AI_ENABLED:'false'})) assert.equal(c.vars[key],value);
 assert.notEqual(c.vars.STRIPE_MODE,'live');
}
function rollback(version,label){
 command('npx',['--no-install','wrangler','rollback',version,'--name',name,
 '--message','QA staging '+label,'--config','wrangler.staging.jsonc'],root,'rollback');
}
const temp=mkdtempSync(join(tmpdir(),'mentioncheck-rollback-'));
const dirs=[];let baseline=null,mutated=false,recovered=false,problem=null;
async function publish(sha,label){
 const dir=join(temp,label);
 git(['worktree','add','--detach',dir,sha]);dirs.push(dir);
 assert.equal(git(['rev-parse','HEAD'],dir),sha);
 safeConfig(dir);
 command('npm',['ci','--ignore-scripts','--no-audit','--no-fund'],dir,'deps_'+label);
 command('npm',['run','build'],dir,'build_'+label);
 command('npx',['--no-install','@opennextjs/cloudflare','build','--skipNextBuild',
 '--config','wrangler.staging.jsonc'],dir,'bundle_'+label);
 command('npx',['--no-install','wrangler','deploy','--config','wrangler.staging.jsonc','--dry-run'],dir,'dryrun_'+label);
 mutated=true;
 command('npx',['--no-install','@opennextjs/cloudflare','deploy','--config',
 'wrangler.staging.jsonc','--','--keep-vars'],dir,'publish_'+label);
 const version=await active();
 assert.equal(await hasSecrets(version),true,'Missing secrets after publish '+label);
 await smoke(label);
 console.log('STAGING_CODE_DEPLOY_'+label+'_PASS sha='+sha+' version='+version);
 return version;
}
try{
 safeConfig(root);baseline=await active();
 assert.equal(await hasSecrets(baseline),true,'Unhealthy initial bindings');
 await smoke('INITIAL');
 console.log('STAGING_CODE_ORIGINAL_VERSION='+baseline);
 const a=await publish(aSha,'A');
 const b=await publish(bSha,'B');
 assert.notEqual(a,b,'Cloudflare versions were identical');
 rollback(a,'two-SHA rollback B to A');
 assert.equal(await active(),a);
 assert.equal(await hasSecrets(a),true);
 await smoke('ROLLED_BACK_A');
 console.log('STAGING_TWO_SHA_ROLLBACK_PASS sha_a='+aSha+' sha_b='+bSha);
}catch(error){problem=error;console.log('STAGING_ROLLBACK_ERROR='+error.message);}
finally{
 if(mutated&&baseline){
  try{
   rollback(baseline,'restore initial state');
   assert.equal(await active(),baseline);
   assert.equal(await hasSecrets(baseline),true);
   await smoke('ORIGINAL_RESTORED');
   recovered=true;
   console.log('STAGING_ORIGINAL_DEPLOYMENT_RESTORED_PASS');
  }catch(error){problem=Error((problem?.message??'')+' RESTORE_FAILED_'+error.message);
    console.log('STAGING_ORIGINAL_DEPLOYMENT_RESTORED_FAIL');}
 }else if(!mutated){recovered=true;}
 for(const dir of dirs.reverse()){try{git(['worktree','remove','--force',dir]);}catch{}}
 rmSync(temp,{recursive:true,force:true});
}
if(problem||!recovered)throw problem??Error('Unverified restoration');
console.log('STAGING_TWO_SHA_CERTIFICATION_PASS');
