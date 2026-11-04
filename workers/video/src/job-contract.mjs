// Contrat pur et strict du job vidéo ; aucune connexion réseau ou IA.
// Une même vidéo et une même empreinte génèrent toujours la même identité.
import {createHash} from 'node:crypto';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA=/^[0-9a-f]{64}$/;
const PATH=/^([0-9a-f-]{36})\/([0-9a-f-]{36})\.(mp4|mov)$/i;
export const MAX_ATTEMPTS=3;
export const LEASE_MS=5*60*1000;
export function createVideoJob({assetId,userId,storagePath,sha256,status,kind},now=new Date()){
  if(!UUID.test(assetId)||!UUID.test(userId)||!SHA.test(sha256)||
     status!=='ready'||kind!=='video'||!Number.isFinite(now.getTime()))
    throw new Error('Job vidéo invalide ou média non confirmé');
  const m=PATH.exec(storagePath||'');
  if(!m||!UUID.test(m[1])||!UUID.test(m[2])||
     m[1].toLowerCase()!==userId.toLowerCase())
    throw new Error('Chemin privé vidéo invalide');
  const key=createHash('sha256').update(assetId.toLowerCase()+':'+sha256).digest('hex');
  return Object.freeze({schemaVersion:1,key,assetId,userId,sha256,
    state:'queued',attempts:0,createdAt:now.toISOString(),aiCalls:0});
}
export function nextJobState(job,event,now=new Date()){
  if(!Number.isFinite(now.getTime())||!job||!SHA.test(job.key))
    throw new Error('État de job invalide');
  if(event==='claim'&&job.state==='queued'&&job.attempts<MAX_ATTEMPTS)
    return {...job,state:'processing',attempts:job.attempts+1,
      leaseUntil:new Date(now.getTime()+LEASE_MS).toISOString()};
  if(event==='success'&&job.state==='processing'&&Date.parse(job.leaseUntil)>now.getTime())
    return {...job,state:'extracted',leaseUntil:null};
  if(event==='failure'&&job.state==='processing')
    return {...job,state:job.attempts>=MAX_ATTEMPTS?'failed':'queued',leaseUntil:null};
  if(event==='timeout'&&job.state==='processing'&&Date.parse(job.leaseUntil)<=now.getTime())
    return {...job,state:job.attempts>=MAX_ATTEMPTS?'failed':'queued',leaseUntil:null};
  throw new Error('Transition de job refusée');
}
