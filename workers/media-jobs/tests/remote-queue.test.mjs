import {it} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {randomUUID,createHash} from 'node:crypto';
import sharp from 'sharp';
import {runQueuedMediaJob} from '../src/queue-runner.mjs';
import {createRemoteMediaQueue} from '../src/remote-queue.mjs';
const owner='81000000-0000-4000-8000-000000000001';
async function fixture(t){
 const root=await mkdtemp(join(tmpdir(),'remote-media-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const inputRoot=join(root,'inputs'),outputRoot=join(root,'outputs');await mkdir(inputRoot);await mkdir(outputRoot);
 const id=randomUUID(),token=randomUUID(),objects=new Map(),uploads=[];let finished,failed,cancelled=false,tamper=false,uploadError=false;
 const inputs=[];for(let i=0;i<2;i++){
  const bytes=await sharp({create:{width:64,height:64,channels:3,background:i?'red':'blue'}}).png().toBuffer();
  const path=`${owner}/${randomUUID()}.png`;objects.set('verification-media/'+path,bytes);inputs.push({path,sha256:createHash('sha256').update(bytes).digest('hex')});
 }
 const job={schemaVersion:1,id,kind:'carousel',inputs};
 const client={rpc:async(name,args)=>{
  if(name==='media_job_claim')return {data:[{id,lease_token:token,payload:job}],error:null};
  if(name==='media_job_finish'){finished=args;return {data:!cancelled,error:null};}
  if(name==='media_job_fail'){failed=args;return {data:true,error:null};}
  throw Error('RPC inattendue');
 },from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{user_id:owner,status:cancelled?'cancelled':'processing',lease_token:token,lease_until:new Date(Date.now()+300000).toISOString()},error:null})})})}),storage:{from:bucket=>({
  download:async path=>{let b=objects.get(bucket+'/'+path);if(tamper&&bucket==='verification-media-derived')b=Buffer.from('altéré');return {data:b?new Blob([b]):null,error:b?null:{message:'Absent'}};},
  upload:async(path,bytes,options)=>{uploads.push({bucket,path,options});if(uploadError)return {error:{message:'Panne'}};if(objects.has(bucket+'/'+path))return {error:{message:'Doublon'}};objects.set(bucket+'/'+path,Buffer.from(bytes));return {error:null};},
 })}};
 const queue=createRemoteMediaQueue({client,inputRoot,outputRoot});
 return {queue,client,inputRoot,outputRoot,id,token,objects,uploads,job,finished:()=>finished,failed:()=>failed,cancel:()=>{cancelled=true;},tamper:()=>{tamper=true;},uploadError:()=>{uploadError=true;}};
}
it('télécharge les sources privées, décode réellement et archive seulement après relecture des sorties',async t=>{
 const f=await fixture(t);assert.equal((await runQueuedMediaJob({...f,workerId:randomUUID()})).state,'completed');
 assert.equal(f.uploads.length,3);assert.ok(f.uploads.every(u=>u.bucket==='verification-media-derived'&&u.options.upsert===false));
 const result=f.finished().p_result;assert.equal(result.aiCalls,0);assert.equal(result.delivery.bucket,'verification-media-derived');
 assert.ok(result.delivery.prefix.startsWith(owner+'/'+f.id+'/'));assert.equal(result.artifacts.length,3);
 assert.equal(f.finished().p_token,f.token);
 assert.ok((await readFile(join(f.inputRoot,f.job.inputs[0].path))).length>0);
});
it('refuse une source dont les octets ne correspondent plus au hash enregistré en base',async t=>{
 const f=await fixture(t);f.objects.set('verification-media/'+f.job.inputs[0].path,Buffer.from('altéré'));
 await assert.rejects(runQueuedMediaJob({...f,workerId:randomUUID()}),/Source privée invalide/);
 assert.equal(f.failed().p_code,'INPUT_INVALID');assert.equal(f.uploads.length,0);assert.equal(f.finished(),undefined);
});
it('refuse un chemin source appartenant à un autre compte avant téléchargement',async t=>{
 const f=await fixture(t);f.job.inputs[0].path=`${randomUUID()}/${randomUUID()}.png`;
 await assert.rejects(runQueuedMediaJob({...f,workerId:randomUUID()}));assert.equal(f.uploads.length,0);assert.equal(f.finished(),undefined);
});
it('ne finalise pas un upload en échec ou une sortie distante altérée',async t=>{
 for(const mode of ['uploadError','tamper']){
  const f=await fixture(t);f[mode]();const result=await runQueuedMediaJob({...f,workerId:randomUUID()});
  assert.equal(result.state,'failed');assert.equal(f.finished(),undefined);assert.equal(f.failed().p_code,mode==='uploadError'?'PROCESS_FAILED':'OUTPUT_INVALID');
 }
});
// Les pannes de transport doivent pouvoir être reprises par media_job_fail ; les détails du fournisseur restent privés.
for(const stage of ['source','upload','reread'])for(const rejected of [false,true]){
 it(`reprend une panne ${rejected?'rejetée':'retournée'} de Storage pendant ${stage}`,async t=>{
  const f=await fixture(t),from=f.client.storage.from,privateDetail='secret-fournisseur-ne-pas-propager';
  f.client.storage.from=bucket=>{
   const store=from(bucket),method=stage==='upload'?'upload':'download';
   if((stage==='source')===(bucket==='verification-media'))store[method]=async()=>{
    if(rejected)throw new Error(privateDetail);
    return {data:null,error:{statusCode:'503',message:privateDetail}};
   };
   return store;
  };
  if(stage==='source')await assert.rejects(runQueuedMediaJob({...f,workerId:randomUUID()}),error=>error.code==='PROCESS_FAILED'&&!error.message.includes(privateDetail));
  else assert.equal((await runQueuedMediaJob({...f,workerId:randomUUID()})).code,'PROCESS_FAILED');
  assert.equal(f.failed().p_code,'PROCESS_FAILED');assert.equal(f.finished(),undefined);
  if(stage==='source')assert.equal(f.uploads.length,0);
 });
}
for(const stage of ['source','reread']){
 it(`reprend un corps Storage interrompu pendant ${stage}`,async t=>{
  const f=await fixture(t),from=f.client.storage.from;
  f.client.storage.from=bucket=>{
   const store=from(bucket),download=store.download;
   if((stage==='source')===(bucket==='verification-media'))store.download=async path=>{
    const response=await download(path);
    return {...response,data:{size:response.data.size,arrayBuffer:async()=>{throw Error('Corps réseau privé interrompu');}}};
   };
   return store;
  };
  if(stage==='source')await assert.rejects(runQueuedMediaJob({...f,workerId:randomUUID()}),error=>error.code==='PROCESS_FAILED');
  else assert.equal((await runQueuedMediaJob({...f,workerId:randomUUID()})).code,'PROCESS_FAILED');
  assert.equal(f.failed().p_code,'PROCESS_FAILED');assert.equal(f.finished(),undefined);
 });
}
it('détecte une sortie distante altérée même quand sa taille reste exacte',async t=>{
 const f=await fixture(t),from=f.client.storage.from;
 f.client.storage.from=bucket=>{
  const store=from(bucket),download=store.download;
  if(bucket==='verification-media-derived')store.download=async path=>{
   const response=await download(path);return {...response,data:new Blob([Buffer.alloc(response.data.size,1)])};
  };
  return store;
 };
 assert.equal((await runQueuedMediaJob({...f,workerId:randomUUID()})).code,'OUTPUT_INVALID');
 assert.equal(f.uploads.length,1);assert.equal(f.failed().p_code,'OUTPUT_INVALID');assert.equal(f.finished(),undefined);
});
it('conserve une source absente en erreur définitive et ne transmet aucun message fournisseur',async t=>{
 const f=await fixture(t),from=f.client.storage.from;
 f.client.storage.from=bucket=>({...from(bucket),download:async()=>({data:null,error:{statusCode:'404',message:'chemin-prive-et-identifiants'}})});
 await assert.rejects(runQueuedMediaJob({...f,workerId:randomUUID()}),error=>error.code==='INPUT_INVALID'&&!error.message.includes('chemin-prive'));
 assert.equal(f.failed().p_code,'INPUT_INVALID');assert.equal(f.uploads.length,0);
});
for(const kind of ['carousel','video'])for(const bytes of [0,(kind==='video'?50:8)*1024*1024+1]){
 it(`refuse ${bytes} octets pour ${kind} avant de lire la source ou de décoder`,async t=>{
  const f=await fixture(t),from=f.client.storage.from;let reads=0;
  if(kind==='video'){f.job.kind='video';f.job.inputs=[{path:`${owner}/${randomUUID()}.mp4`,sha256:'0'.repeat(64)}];}
  f.client.storage.from=bucket=>({...from(bucket),download:async()=>({data:{size:bytes,arrayBuffer:async()=>{reads++;throw Error('Lecture interdite');}},error:null})});
  await assert.rejects(runQueuedMediaJob({...f,workerId:randomUUID()}),error=>error.code==='INPUT_INVALID');
  assert.equal(reads,0);assert.equal(f.uploads.length,0);assert.equal(f.finished(),undefined);
 });
}
it('ne publie pas les sorties si le bail est annulé',async t=>{
 const f=await fixture(t);await f.queue.claim(randomUUID());f.cancel();assert.equal(await f.queue.isCancelled(f.id,f.token),true);
 assert.equal(await f.queue.complete(f.id,f.token,{}),false);assert.equal(f.uploads.length,0);assert.equal(f.finished(),undefined);
});

it('reprend une panne Storage avec délai SQL puis finalise la même vérification via les vraies RPC locales',async t=>{
 const {createOfflineDatabase}=await import('../../../scripts/test-sql-offline.mjs');
 const db=await createOfflineDatabase();t.after(()=>db.close());const f=await fixture(t),assets=[];
 await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[owner,'remote-fixture@example.test']);
 const group=randomUUID();
 for(const input of f.job.inputs){
  const id=randomUUID(),bytes=f.objects.get('verification-media/'+input.path);assets.push(id);
  await db.query(`insert into public.media_assets(id,user_id,group_id,kind,status,storage_path,mime_type,declared_bytes,actual_bytes,completed_at,expires_at,media_sha256)
   values($1,$2,$3,'image','ready',$4,'image/png',$5,$5,now(),now()+interval '1 day',$6)`,[id,owner,group,input.path,bytes.length,input.sha256]);
 }
 const id=(await db.query(`select public.media_job_enqueue($1,$2::uuid[],'Publicité — Test','instagram',$3::jsonb) as id`,[owner,assets,JSON.stringify({score:100,riskLevel:'low',violations:[]})])).rows[0].id;
 f.client.rpc=async(name,args)=>{
  const statements={media_job_claim:['select * from public.media_job_claim($1::uuid)',[args.p_worker]],
   media_job_finish:['select public.media_job_finish($1::uuid,$2::uuid,$3::jsonb) as value',[args.p_job,args.p_token,JSON.stringify(args.p_result)]],
   media_job_fail:['select public.media_job_fail($1::uuid,$2::uuid,$3::text) as value',[args.p_job,args.p_token,args.p_code]]};
  const [sql,params]=statements[name];const {rows}=await db.query(sql,params);return {data:name==='media_job_claim'?rows:rows[0].value,error:null};
 };
 f.client.from=()=>({select:()=>({eq:(_column,value)=>({maybeSingle:async()=>({data:(await db.query('select user_id,status,lease_token,lease_until from public.media_processing_jobs where id=$1',[value])).rows[0],error:null})})})});
 const from=f.client.storage.from;
 f.client.storage.from=bucket=>bucket==='verification-media'?{...from(bucket),download:async()=>({data:null,error:{status:503,message:'Transport hors ligne'}})}:from(bucket);
 await assert.rejects(runQueuedMediaJob({...f,workerId:randomUUID()}),error=>error.code==='PROCESS_FAILED');
 const retry=(await db.query(`select j.status,j.attempts,j.failure_code,j.available_at>now() as delayed,v.status as verification_status
  from public.media_processing_jobs j join public.verifications v on v.id=j.verification_id where j.id=$1`,[id])).rows[0];
 assert.deepEqual(retry,{status:'queued',attempts:1,failure_code:'PROCESS_FAILED',delayed:true,verification_status:'queued'});
 assert.deepEqual(await runQueuedMediaJob({...f,workerId:randomUUID()}),{state:'idle'});
 // Horloge de la seule fixture mémoire : aucune attente et aucune mutation d'un service réel.
 await db.query("update public.media_processing_jobs set available_at=now()-interval '1 second' where id=$1",[id]);
 f.client.storage.from=from;
 assert.deepEqual(await runQueuedMediaJob({...f,workerId:randomUUID()}),{state:'completed',id});
 const row=(await db.query('select result from public.media_processing_jobs where id=$1',[id])).rows[0];
 assert.equal(row.result.delivery.bucket,'verification-media-derived');assert.equal(row.result.aiCalls,0);
 assert.equal(f.uploads.length,3);assert.ok(row.result.delivery.prefix.startsWith(owner+'/'+id+'/'));
 assert.deepEqual((await db.query('select attempts,(select count(*)::integer from public.verifications) as verifications from public.media_processing_jobs where id=$1',[id])).rows[0],{attempts:2,verifications:1});
});

it('transporte une vidéo privée puis publie les trois frames FFmpeg réelles',async t=>{
 const f=await fixture(t),path=`${owner}/${randomUUID()}.mp4`,local=join(f.outputRoot,'synthetic.mp4');
 const made=spawnSync('/usr/bin/ffmpeg',['-nostdin','-v','error','-f','lavfi','-i','color=c=blue:s=160x120:r=6','-t','1','-c:v','mpeg4','-threads','1','-y',local],{timeout:15000});
 assert.equal(made.status,0);const bytes=await readFile(local);f.objects.set('verification-media/'+path,bytes);
 f.job.kind='video';f.job.inputs=[{path,sha256:createHash('sha256').update(bytes).digest('hex')}];
 assert.equal((await runQueuedMediaJob({...f,workerId:randomUUID()})).state,'completed');
 assert.equal(f.finished().p_result.artifacts.filter(a=>a.name.endsWith('.jpg')).length,3);
});
it('un bail perdu pendant la publication laisse les sorties non référencées et ne finalise pas',async t=>{
 const f=await fixture(t),from=f.client.storage.from;
 f.client.storage.from=bucket=>{const store=from(bucket);if(bucket==='verification-media-derived'){
  const upload=store.upload;store.upload=async(...args)=>{const out=await upload(...args);f.cancel();return out;};
 }return store;};
 assert.equal((await runQueuedMediaJob({...f,workerId:randomUUID()})).state,'stale');
 assert.equal(f.finished(),undefined);assert.equal(f.uploads.length,1);
});
it('revérifie le bail après la toute dernière relecture et refuse une finalisation tardive',async t=>{
 const f=await fixture(t),from=f.client.storage.from;let rereads=0;
 f.client.storage.from=bucket=>{
  const store=from(bucket),download=store.download;
  if(bucket==='verification-media-derived')store.download=async path=>{
   const result=await download(path);if(++rereads===3)f.cancel();return result;
  };
  return store;
 };
 assert.equal((await runQueuedMediaJob({...f,workerId:randomUUID()})).state,'stale');
 assert.equal(rereads,3);assert.equal(f.uploads.length,3);assert.equal(f.finished(),undefined);
});
