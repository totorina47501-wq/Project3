import { test } from 'node:test';
import assert from 'node:assert/strict';
import {createVideoJob,nextJobState,MAX_ATTEMPTS,LEASE_MS} from '../src/job-contract.mjs';
const assetId='44444444-4444-4444-8444-444444444444';
const storageId='55555555-5555-4555-8555-555555555555';
const userId='33333333-3333-4333-8333-333333333333';
const leaseA='11111111-1111-4111-8111-111111111111';
const leaseB='22222222-2222-4222-8222-222222222222';
const sha='a'.repeat(64);
const when=new Date('2026-11-04T00:00:00.000Z');
const row={id:assetId,user_id:userId,
  storage_path:userId+'/'+storageId+'.mp4',media_sha256:sha,
  status:'ready',kind:'video',mime_type:'video/mp4',
  actual_bytes:1024,expires_at:'2026-12-01T00:00:00.000Z'};
test('génère une clé idempotente depuis une même ligne DB sans appel IA',()=>{
  const a=createVideoJob(row,when);
  const b=createVideoJob(row,when);
  assert.equal(a.key,b.key);
  assert.equal(a.aiCalls,0);
  assert.equal(a.assetId,assetId);
  assert.notEqual(storageId,assetId,'Les deux UUID sont volontairement différents');
  assert.notEqual(a.key,createVideoJob({...row,media_sha256:'b'.repeat(64)},when).key);
});
test('refuse un média non confirmé, expiré ou sans SHA persisté',()=>{
  for(const bad of [
    {status:'pending'},{kind:'image'},{media_sha256:null},
    {media_sha256:'invalid'},{actual_bytes:0},{actual_bytes:50*1024*1024+1},
    {expires_at:'2026-10-31T00:00:00Z'}, {expires_at:'invalid'},
  ])assert.throws(()=>createVideoJob({...row,...bad},when));
});
test('refuse un propriétaire ou un chemin incohérent, un MIME erroné',()=>{
  for(const bad of [
    {user_id:assetId},
    {storage_path:assetId+'/'+storageId+'.mp4'},
    {storage_path:userId+'/'+storageId+'.jpg'},
    {storage_path:userId+'/'+storageId+'.mov'},
    {storage_path:userId+'/../'+storageId+'.mp4'},
    {mime_type:'video/quicktime'},
  ])assert.throws(()=>createVideoJob({...row,...bad},when));
  assert.equal(createVideoJob({...row,storage_path:userId+'/'+storageId+'.mov',
    mime_type:'video/quicktime'},when).state,'queued');
});
test('demande un lease UUID et refuse un second claim concurrent dans le même état',()=>{
  const job=createVideoJob(row,when);
  assert.throws(()=>nextJobState(job,'claim',when));
  assert.throws(()=>nextJobState(job,'claim',when,'bad'));
  const claimed=nextJobState(job,'claim',when,leaseA);
  assert.equal(claimed.attempts,1);
  assert.equal(claimed.leaseToken,leaseA);
  assert.throws(()=>nextJobState(claimed,'claim',when,leaseB));
});
test('fencing : un ancien bail ne peut ni réussir ni échouer un job repris',()=>{
  const job=createVideoJob(row,when);
  const claimed=nextJobState(job,'claim',when,leaseA);
  const later=new Date(when.getTime()+LEASE_MS+1);
  assert.throws(()=>nextJobState(claimed,'success',later,leaseA));
  const requeued=nextJobState(claimed,'timeout',later);
  const resumed=nextJobState(requeued,'claim',later,leaseB);
  assert.throws(()=>nextJobState(resumed,'success',later,leaseA));
  assert.throws(()=>nextJobState(resumed,'failure',later,leaseA));
  assert.equal(nextJobState(resumed,'success',later,leaseB).state,'extracted');
});
test('lease non expiré ne peut être repris et succès est terminal',()=>{
  const job=createVideoJob(row,when);
  const processing=nextJobState(job,'claim',when,leaseA);
  assert.throws(()=>nextJobState(processing,'timeout',new Date(when.getTime()+1)));
  const done=nextJobState(processing,'success',new Date(when.getTime()+1),leaseA);
  assert.equal(done.state,'extracted');
  assert.throws(()=>nextJobState(done,'success',new Date(when.getTime()+2),leaseA));
});
test('nombre borné de reprises, échec terminal après trois tentatives',()=>{
  let job=createVideoJob(row,when);
  for(let n=0;n<MAX_ATTEMPTS;n++){
    job=nextJobState(job,'claim',when,leaseA);
    job=nextJobState(job,'failure',when,leaseA);
  }
  assert.equal(job.attempts,MAX_ATTEMPTS);
  assert.equal(job.state,'failed');
  assert.throws(()=>nextJobState(job,'claim',when,leaseB));
});
test('fichier expiré ou horodatage invalide bloque la construction du job',()=>{
  assert.throws(()=>createVideoJob(row,new Date('invalid')));
  assert.throws(()=>nextJobState(createVideoJob(row,when),'claim',new Date('invalid'),leaseA));
});
