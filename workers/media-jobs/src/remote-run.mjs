#!/usr/bin/env node
// Point d'entrée explicite : jamais importé par Next.js ou le runner local.
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {DERIVED_BUCKET} from './remote-queue.mjs';
import {readRunnerConfig,runRemoteMediaOnce,runRemoteLoop} from './remote-runtime.mjs';
const controller=new AbortController();
const stop=()=>controller.abort();process.once('SIGINT',stop);process.once('SIGTERM',stop);
try{
 const config=readRunnerConfig(process.env),workerId=randomUUID();
 const clientFor=signal=>createClient(config.url,config.key,{
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
  global:{fetch:(input,init={})=>fetch(input,{...init,redirect:'error',signal:AbortSignal.any([
   signal,AbortSignal.timeout(20000),...(init.signal?[init.signal]:[]),...(input instanceof Request?[input.signal]:[]),
  ])})},
 });
 const startup=clientFor(controller.signal);
 for(const name of ['verification-media',DERIVED_BUCKET]){
  const {data,error}=await startup.storage.getBucket(name);
  if(error||!data||data.public)throw new Error('Bucket privé indisponible.');
 }
 await runRemoteLoop({signal:controller.signal,pollMs:config.pollMs,once:process.env.MEDIA_RUNNER_ONCE==='true',runOnce:async()=>{
  // Le budget de bout en bout reste inférieur au bail SQL de cinq minutes.
  const signal=AbortSignal.any([controller.signal,AbortSignal.timeout(240000)]);
  return runRemoteMediaOnce({client:clientFor(signal),workRoot:config.workRoot,workerId,signal});
 }});
}catch{
 if(!controller.signal.aborted){console.error(JSON.stringify({state:'error',code:'RUNNER_UNAVAILABLE'}));process.exitCode=1;}
}finally{process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);}
