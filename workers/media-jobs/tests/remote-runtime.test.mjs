import {it} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {readRunnerConfig,runRemoteMediaOnce,runRemoteLoop} from '../src/remote-runtime.mjs';
it('refuse le démarrage sans opt-in avant de lire les secrets',()=>{
 assert.throws(()=>readRunnerConfig({}),/désactivé/);
 assert.throws(()=>readRunnerConfig({MEDIA_RUNNER_ENABLED:'true',SUPABASE_URL:'http://127.0.0.1:54321',SUPABASE_SERVICE_KEY:'secret'}),/Configuration/);
});
it('nettoie uniquement son espace temporaire après une file vide ou une panne',async t=>{
 const root=await mkdtemp(join(tmpdir(),'runtime-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const client={rpc:async()=>({data:[],error:null})};
 assert.deepEqual(await runRemoteMediaOnce({client,workRoot:root,workerId:randomUUID()}),{state:'idle'});
 assert.deepEqual(await readdir(root),[]);
 await assert.rejects(runRemoteMediaOnce({client:{rpc:async()=>{throw Error('secret');}},workRoot:root,workerId:randomUUID()}));
 assert.deepEqual(await readdir(root),[]);
});
it('la boucle cesse sans nouvelle réservation après arrêt et minimise les erreurs',async()=>{
 const controller=new AbortController(),logs=[];let calls=0;
 await runRemoteLoop({signal:controller.signal,pollMs:1,runOnce:async()=>{calls++;controller.abort();throw Error('provider-private-sentinel');},log:entry=>logs.push(entry)});
 assert.equal(calls,1);assert.deepEqual(logs,[{state:'error',code:'PROCESS_FAILED'}]);
});
it('le mode one-shot termine après un seul essai sans garder une boucle payante active',async()=>{
 const controller=new AbortController();let calls=0;
 await runRemoteLoop({once:true,signal:controller.signal,pollMs:1,log:()=>{},runOnce:async()=>{if(++calls>1)controller.abort();return {state:'idle'};}});
 assert.equal(calls,1);
});
