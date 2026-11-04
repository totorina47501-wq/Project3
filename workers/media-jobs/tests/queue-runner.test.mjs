import {it} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {runQueuedMediaJob} from '../src/queue-runner.mjs';
async function fixture(t,video=false){
 const root=await mkdtemp(join(tmpdir(),'media-queue-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const inputRoot=join(root,'inputs'),outputRoot=join(root,'outputs');await mkdir(inputRoot);await mkdir(outputRoot);
 let paths;
 if(video){paths=['clip.mp4'];const made=spawnSync('/usr/bin/ffmpeg',['-nostdin','-v','error','-f','lavfi','-i','color=c=red:s=160x120:r=10','-t','1','-c:v','mpeg4','-threads','1','-y',join(inputRoot,paths[0])]);assert.equal(made.status,0,String(made.stderr));}
 else {const sharp=(await import('sharp')).default;paths=['a.png','b.png'];for(const path of paths)await sharp({create:{width:64,height:48,channels:3,background:'red'}}).png().toFile(join(inputRoot,path));}
 const inputs=await Promise.all(paths.map(async path=>({path,sha256:createHash('sha256').update(await readFile(join(inputRoot,path))).digest('hex')})));
 const lease={id:'queue-1',leaseToken:'lease-1',job:{schemaVersion:1,id:'queue-1',kind:video?'video':'carousel',inputs}};
 let completed,failed;const queue={claim:async()=>lease,isCancelled:async()=>false,complete:async(id,token,result)=>{completed={id,token,result};return true;},fail:async(id,token,code)=>{failed={id,token,code};return true;}};
 return {inputRoot,outputRoot,lease,queue,completed:()=>completed,failed:()=>failed};
}
it('relie la file au processeur Sharp réel et transmet le bail et les preuves',async t=>{
 const f=await fixture(t);assert.equal((await runQueuedMediaJob({...f,workerId:'worker-1'})).state,'completed');assert.equal(f.completed().token,'lease-1');assert.equal(f.completed().result.artifacts.length,3);assert.equal(f.failed(),undefined);
});
it('relie la file au processeur FFmpeg réel',async t=>{const f=await fixture(t,true);assert.equal((await runQueuedMediaJob({...f,workerId:'worker-1'})).state,'completed');assert.equal(f.completed().result.kind,'video');});
it('refuse les sources sans empreinte et persiste une erreur neutre',async t=>{const f=await fixture(t);delete f.lease.job.inputs[0].sha256;assert.equal((await runQueuedMediaJob({...f,workerId:'worker-1'})).code,'JOB_INVALID');assert.equal(f.failed().code,'JOB_INVALID');assert.equal(f.completed(),undefined);});
it('ne termine pas une réservation annulée ou périmée',async t=>{const f=await fixture(t);f.queue.isCancelled=async()=>true;assert.equal((await runQueuedMediaJob({...f,workerId:'worker-1'})).state,'cancelled');assert.equal(f.completed(),undefined);});
it('respecte le rejet CAS après production et permet une nouvelle tentative idempotente',async t=>{const f=await fixture(t);const complete=f.queue.complete;f.queue.complete=async()=>false;assert.equal((await runQueuedMediaJob({...f,workerId:'worker-1'})).state,'stale');f.queue.complete=complete;assert.equal((await runQueuedMediaJob({...f,workerId:'worker-1'})).state,'completed');});
it('annule un traitement actif dès le signal de file et libère le sous-processus',async t=>{const f=await fixture(t);let checks=0;f.queue.isCancelled=async()=>++checks>2;assert.equal((await runQueuedMediaJob({...f,workerId:'worker-1',pollMs:2})).state,'cancelled');assert.equal(f.completed(),undefined);});
it('une file vide ne traite aucun média',async()=>{assert.deepEqual(await runQueuedMediaJob({queue:{claim:async()=>null},workerId:'w'}),{state:'idle'});});
it('adaptateur SQL transmet uniquement les paramètres et échoue fermé pour bail absent',async()=>{
 const {createLocalSqlMediaQueue}=await import('../src/sql-queue.mjs');const calls=[];
 const db={query:async(sql,args)=>{calls.push({sql,args});return {rows:sql.includes('media_job_claim')?[{id:'id',lease_token:'token',payload:{kind:'video'}}]:sql.includes('as active')?[]:[{accepted:true}]};}};
 const queue=createLocalSqlMediaQueue(db);assert.equal((await queue.claim('worker')).leaseToken,'token');assert.equal(await queue.isCancelled('id','token'),true);assert.equal(await queue.complete('id','token',{aiCalls:0}),true);assert.deepEqual(calls.at(-1).args,['id','token','{"aiCalls":0}']);assert.equal(await queue.fail('id','token','INPUT_INVALID'),true);
});
