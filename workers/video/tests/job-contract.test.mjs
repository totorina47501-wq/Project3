import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createVideoJob,nextJobState,MAX_ATTEMPTS} from '../src/job-contract.mjs';
const assetId='44444444-4444-4444-8444-444444444444';
const userId='33333333-3333-4333-8333-333333333333';
const sha256='a'.repeat(64);
const base={assetId,userId,sha256,status:'ready',kind:'video',
 storagePath:userId+'/'+assetId+'.mp4'};
test('clé idempotente asset+digest et aucune IA',()=>{
 const a=createVideoJob(base);const b=createVideoJob(base);
 assert.equal(a.key,b.key);assert.equal(a.aiCalls,0);
 assert.notEqual(a.key,createVideoJob({...base,sha256:'b'.repeat(64)}).key);
});
test('refus des objets non confirmés et des chemins hors propriétaire',()=>{
 assert.throws(()=>createVideoJob({...base,status:'pending'}));
 assert.throws(()=>createVideoJob({...base,kind:'image'}));
 assert.throws(()=>createVideoJob({...base,storagePath:assetId+'/'+assetId+'.mp4'}));
 assert.throws(()=>createVideoJob({...base,sha256:'invalid'}));
});
test('claim, extraction et absence de double exécution',()=>{
 const job=createVideoJob(base,new Date(0));
 const claimed=nextJobState(job,'claim',new Date(1000));
 assert.equal(claimed.attempts,1);
 assert.throws(()=>nextJobState(claimed,'claim',new Date(2000)));
 assert.equal(nextJobState(claimed,'success',new Date(2000)).state,'extracted');
 assert.throws(()=>nextJobState(nextJobState(claimed,'success',new Date(2000)),'success',new Date(2000)));
});
test('reprise bornée puis échec définitif',()=>{
 let job=createVideoJob(base);
 for(let i=0;i<MAX_ATTEMPTS;i++){
   job=nextJobState(job,'claim');
   job=nextJobState(job,'failure');
 }
 assert.equal(job.state,'failed');assert.equal(job.attempts,MAX_ATTEMPTS);
 assert.throws(()=>nextJobState(job,'claim'));
});
test('lease non expiré non récupérable, expiré récupérable',()=>{
 const t=new Date('2026-11-04T00:00:00Z');
 const job=nextJobState(createVideoJob(base,t),'claim',t);
 assert.throws(()=>nextJobState(job,'timeout',new Date(t.getTime()+1000)));
 assert.equal(nextJobState(job,'timeout',new Date(t.getTime()+300001)).state,'queued');
});
