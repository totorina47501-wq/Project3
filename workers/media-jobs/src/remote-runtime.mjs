// Cycle distant opt-in, sans IA. Chaque essai possède un espace local jetable.
import {mkdtemp,mkdir,rm,lstat,realpath} from 'node:fs/promises';
import {isAbsolute,join,resolve} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {createRemoteMediaQueue} from './remote-queue.mjs';
import {runQueuedMediaJob} from './queue-runner.mjs';
export function readRunnerConfig(env){
 if(env.MEDIA_RUNNER_ENABLED!=='true')throw new Error('Runner distant désactivé.');
 if(!/^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(env.SUPABASE_URL??'')||!env.SUPABASE_SERVICE_KEY?.trim()||
    !isAbsolute(env.MEDIA_RUNNER_WORK_ROOT??'')||!/^\d+$/.test(env.MEDIA_RUNNER_POLL_MS??'5000'))throw new Error('Configuration du runner invalide.');
 const pollMs=Number(env.MEDIA_RUNNER_POLL_MS??5000);if(pollMs<1000||pollMs>60000)throw new Error('Configuration du runner invalide.');
 return {url:env.SUPABASE_URL,key:env.SUPABASE_SERVICE_KEY,workRoot:resolve(env.MEDIA_RUNNER_WORK_ROOT),pollMs};
}
export async function runRemoteMediaOnce({client,workRoot,workerId,signal}={}){
 if(signal?.aborted)return {state:'stopped'};
 if(!isAbsolute(workRoot??''))throw new Error('Racine privée requise.');
 await mkdir(workRoot,{recursive:true,mode:0o700});
 const info=await lstat(workRoot);
 if(!info.isDirectory()||info.isSymbolicLink()||await realpath(workRoot)!==workRoot||(info.mode&0o077)!==0)throw new Error('Racine privée requise.');
 const attempt=await mkdtemp(join(workRoot,'attempt-'));
 try{
  const inputRoot=join(attempt,'inputs'),outputRoot=join(attempt,'outputs');
  await mkdir(inputRoot,{mode:0o700});await mkdir(outputRoot,{mode:0o700});
  const queue=createRemoteMediaQueue({client,inputRoot,outputRoot,signal});
  return await runQueuedMediaJob({queue,workerId,inputRoot,outputRoot,signal,pollMs:1000});
 }finally{
  // Uniquement le répertoire temporaire de cet essai ; aucun objet Storage supprimé.
  await rm(attempt,{recursive:true,force:true});
 }
}
export async function runRemoteLoop({runOnce,signal,pollMs=5000,once=false,log=entry=>console.log(JSON.stringify(entry))}={}){
 if(!Number.isInteger(pollMs)||pollMs<1||pollMs>60000)throw new Error('Intervalle invalide.');
 while(!signal?.aborted){
  let failed=false;
  try{const result=await runOnce();log({state:result.state,...(result.id?{id:result.id}:{}),...(result.code?{code:result.code}:{})});}
  catch{failed=true;log({state:'error',code:'PROCESS_FAILED'});}
  if(once||signal?.aborted)break;
  try{await delay(failed?Math.max(30000,pollMs):pollMs,undefined,{signal});}catch{if(!signal?.aborted)throw new Error('Attente interrompue.');}
 }
}
