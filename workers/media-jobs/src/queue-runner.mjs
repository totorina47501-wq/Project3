// Adaptateur injecté : aucune connexion, activation ou boucle serveur implicite.
import {runMediaJob,MediaJobError} from './jobs.mjs';
const SAFE_CODES=new Set(['JOB_INVALID','INPUT_INVALID','OUTPUT_INVALID','JOB_CONFLICT','JOB_LOCKED','TIMEOUT','CANCELLED','PROCESS_FAILED']);
export async function runQueuedMediaJob({queue,workerId,inputRoot,outputRoot,signal,pollMs=100}={}){
 if(!Number.isInteger(pollMs)||pollMs<1||pollMs>10000)throw new TypeError('Intervalle invalide');
 const lease=await queue.claim(workerId);
 if(!lease)return {state:'idle'};
 const {id,leaseToken,job}=lease;
 const controller=new AbortController();let timer,pendingCheck,monitorError=false;
 const abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
 const check=()=>{
  if(pendingCheck)return pendingCheck;
  pendingCheck=(async()=>{
   try{if(await queue.isCancelled(id,leaseToken))abort();}
   catch{monitorError=true;abort();}
  })().finally(()=>{pendingCheck=undefined;});
  return pendingCheck;
 };
 try{
  // Les empreintes sont obligatoires dans la file ; runMediaJob les revérifie sur son snapshot local.
  if(!job||job.id!==id||!Array.isArray(job.inputs)||job.inputs.some(input=>!/^[a-f0-9]{64}$/.test(input?.sha256??'')))throw new MediaJobError('JOB_INVALID','Empreintes sources requises.');
  await check();
  if(controller.signal.aborted)throw new MediaJobError('CANCELLED','Job annulé.');
  timer=setInterval(()=>{void check();},pollMs);
  const outcome=await runMediaJob(job,{inputRoot,outputRoot,signal:controller.signal});
  clearInterval(timer);await check();
  if(controller.signal.aborted)throw new MediaJobError('CANCELLED','Job annulé.');
  // Le succès n'est visible en base que si le propriétaire du bail est toujours valide.
  const accepted=await queue.complete(id,leaseToken,outcome.result);
  return {state:accepted?'completed':'stale',id};
 }catch(error){
  const code=monitorError?'PROCESS_FAILED':SAFE_CODES.has(error?.code)?error.code:'PROCESS_FAILED';
  const accepted=await queue.fail(id,leaseToken,code);
  return {state:accepted?(code==='CANCELLED'?'cancelled':'failed'):'stale',id,code};
 }finally{clearInterval(timer);signal?.removeEventListener('abort',abort);}
}
