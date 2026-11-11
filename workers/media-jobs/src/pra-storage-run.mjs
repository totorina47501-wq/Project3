#!/usr/bin/env node
// Explicit internal CLI only. Not exposed by any Worker HTTP route or alarm.
import {createClient} from '@supabase/supabase-js';
import {readPraStorageConfig,verifyPraStorageReadback} from './pra-storage.mjs';
const fail=()=>{console.error('MC_PRA_STORAGE_BLOCKED');process.exitCode=1;};
try{
  if(process.argv.length!==3 || process.argv[2]!=='--verify-storage-readback') throw Error();
  const config=readPraStorageConfig(process.env);
  const controller=new AbortController();
  const deadline=setTimeout(()=>controller.abort(),120000);
  try{
    const client=createClient(config.url,config.key,{
      auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
      global:{fetch:(input,init={})=>fetch(input,{...init,redirect:'error',
        signal:AbortSignal.any([controller.signal,AbortSignal.timeout(20000),
          ...(init.signal?[init.signal]:[]),
          ...(input instanceof Request?[input.signal]:[])]),
      })},
    });
    const result=await verifyPraStorageReadback({
      client,signal:controller.signal,
      expectedObjects:config.expectedObjects,
      expectedBytes:config.expectedBytes,
      expectedMediaHashes:config.expectedMediaHashes,
    });
    console.log(JSON.stringify(result));
  }finally{clearTimeout(deadline);}
}catch{fail();}
