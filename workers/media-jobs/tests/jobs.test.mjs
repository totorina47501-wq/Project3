import {it} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,readdir,rm,symlink,open} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {spawnSync,spawn} from 'node:child_process';
let sharp;
import * as api from '../src/jobs.mjs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
async function fixture(t){
  sharp ??= (await import('sharp')).default;
  const root=await mkdtemp(join(tmpdir(),'mc-jobs-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const inputRoot=join(root,'inputs'),outputRoot=join(root,'outputs');
  await mkdir(inputRoot);await mkdir(outputRoot);
  await sharp({create:{width:64,height:48,channels:3,background:'red'}}).png().toFile(join(inputRoot,'a.png'));
  await sharp({create:{width:48,height:64,channels:3,background:'blue'}}).png().toFile(join(inputRoot,'b.png'));
  return {root,inputRoot,outputRoot};
}
const spec=(id='carousel-1')=>({schemaVersion:1,id,kind:'carousel',inputs:[{path:'a.png'},{path:'b.png'}]});
const run=(...args)=>{assert.equal(typeof api.runMediaJob,'function','exécuteur local requis');return api.runMediaJob(...args);};

it('publie un carrousel Sharp réel avec hashes des octets et reprise vérifiée',async t=>{
  const options=await fixture(t),job=spec();
  const first=await run(job,options);
  assert.equal(first.state,'completed');
  const out=join(options.outputRoot,job.id);
  const result=JSON.parse(await readFile(join(out,'result.json'),'utf8'));
  assert.equal(result.aiCalls,0);assert.equal(result.kind,'carousel');
  assert.equal(result.inputs[0].sha256,hash(await readFile(join(options.inputRoot,'a.png'))));
  assert.equal(result.artifacts.length,3);
  for(const artifact of result.artifacts){
    const bytes=await readFile(join(out,'media',artifact.name));
    assert.equal(bytes.length,artifact.bytes);assert.equal(hash(bytes),artifact.sha256);
    if(artifact.name.endsWith('.webp'))assert.equal((await sharp(bytes).metadata()).format,'webp');
  }
  assert.deepEqual((await readdir(options.outputRoot)),[job.id]);
  assert.deepEqual((await readdir(out)).sort(),['media','result.json']);
  const before=await readFile(join(out,'result.json'));
  assert.equal((await run(job,options)).state,'reused');
  assert.deepEqual(await readFile(join(out,'result.json')),before);
});
it('extrait vidéo et piste audio réelles via les processeurs FFmpeg existants',async t=>{
  const options=await fixture(t),input=join(options.inputRoot,'clip.mp4');
  const made=spawnSync('/usr/bin/ffmpeg',['-nostdin','-v','error','-f','lavfi','-i','color=c=red:s=160x120:r=10','-f','lavfi','-i','sine=frequency=440:sample_rate=16000','-t','1','-c:v','mpeg4','-c:a','aac','-threads','1','-y',input],{timeout:15000});
  assert.equal(made.status,0,String(made.stderr));
  const job={schemaVersion:1,id:'video-1',kind:'video',inputs:[{path:'clip.mp4'}]};
  const result=await run(job,options);
  assert.equal(result.state,'completed');
  const media=join(options.outputRoot,job.id,'media');
  const manifest=JSON.parse(await readFile(join(media,'manifest.json'),'utf8'));
  assert.equal(manifest.frames.length,3);assert.equal(manifest.video.hasAudio,true);
  assert.equal(manifest.video.sha256,hash(await readFile(input)));
  const probe=spawnSync('/usr/bin/ffprobe',['-v','error','-show_streams','-of','json',join(media,'audio-mono.wav')]);
  assert.equal(probe.status,0);
  const stream=JSON.parse(probe.stdout).streams[0];
  assert.equal(stream.channels,1);assert.equal(stream.sample_rate,'16000');
  assert.equal((await run(job,options)).state,'reused');
});
it('refuse les manifests invalides, traversées et liens hors racine',async t=>{
  const options=await fixture(t);
  for(const bad of [null,{...spec(),id:'../escape'},{...spec(),kind:'audio'},
    {...spec(),remote:true},{...spec(),inputs:[{path:'../a.png'},{path:'b.png'}]},
    {...spec(),inputs:[{path:'https://example.com/a.png'},{path:'b.png'}]},
    {...spec(),inputs:[{path:'a.png'},{path:'a.png'}]},
    {...spec(),timeoutMs:0},{...spec(),timeoutMs:120001}]){
    await assert.rejects(run(bad,options));
  }
  await symlink(join(options.inputRoot,'a.png'),join(options.inputRoot,'alias.png'));
  await assert.rejects(run({...spec(),inputs:[{path:'alias.png'},{path:'b.png'}]},options));
  assert.deepEqual(await readdir(options.outputRoot),[]);
});
it('détecte hash source inattendu, octets modifiés et sorties altérées sans écrasement',async t=>{
  const options=await fixture(t),job=spec();
  await assert.rejects(run({...job,inputs:[{path:'a.png',sha256:'0'.repeat(64)},{path:'b.png'}]},options));
  await run(job,options);
  const output=join(options.outputRoot,job.id),proof=await readFile(join(output,'result.json'));
  await writeFile(join(output,'media','slide-01.webp'),'corrupt');
  await assert.rejects(run(job,options),error=>error.code==='OUTPUT_INVALID');
  assert.deepEqual(await readFile(join(output,'result.json')),proof);
  await writeFile(join(options.inputRoot,'a.png'),'changed');
  await assert.rejects(run(job,options),error=>error.code==='JOB_CONFLICT');
});
it('borne les entrées et conserve les erreurs sans publier de succès',async t=>{
  const options=await fixture(t);
  await writeFile(join(options.inputRoot,'b.png'),'invalid');
  await assert.rejects(run(spec(),options),error=>error.code==='PROCESS_FAILED');
  assert.deepEqual(await readdir(options.outputRoot),[]);
  const h=await open(join(options.inputRoot,'a.png'),'w');
  await h.truncate(8*1024*1024+1);await h.close();
  await assert.rejects(run(spec(),options),error=>error.code==='INPUT_INVALID');
  assert.deepEqual(await readdir(options.outputRoot),[]);
});
it('annule avant démarrage et pendant traitement sans dossier final ni verrou restant',async t=>{
  const options=await fixture(t);
  await assert.rejects(run(spec(),{...options,signal:AbortSignal.abort()}),error=>error.code==='CANCELLED');
  const controller=new AbortController();
  const pending=run(spec(),{...options,signal:controller.signal});
  let started=false;
  const timer=setInterval(async()=>{
    const record=await readFile(join(options.outputRoot,'.carousel-1.lock'),'utf8').then(JSON.parse).catch(()=>null);
    if(record?.workerPid){started=true;controller.abort();}
  },2);
  try{await assert.rejects(pending,error=>error.code==='CANCELLED');}finally{clearInterval(timer);}
  assert.equal(started,true,'Annuler un sous-processus réellement démarré.');
  assert.deepEqual(await readdir(options.outputRoot),[]);
});
it('applique le timeout global au sous-processus Sharp et nettoie le stage',async t=>{
  const options=await fixture(t);
  await sharp({create:{width:4000,height:4000,channels:3,background:'red'}}).png().toFile(join(options.inputRoot,'a.png'));
  let workerSeen=false;
  const timer=setInterval(async()=>{
    const record=await readFile(join(options.outputRoot,'.carousel-1.lock'),'utf8').then(JSON.parse).catch(()=>null);
    if(record?.workerPid)workerSeen=true;
  },2);
  try{await assert.rejects(run({...spec(),timeoutMs:100},options),error=>error.code==='TIMEOUT');}
  finally{clearInterval(timer);}
  assert.equal(workerSeen,true,'Le timeout doit atteindre le sous-processus réel.');
  assert.deepEqual(await readdir(options.outputRoot),[]);
});
it('une seule exécution coopérante peut publier le même identifiant',async t=>{
  const options=await fixture(t);
  const results=await Promise.allSettled([run(spec(),options),run(spec(),options)]);
  assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
  assert.equal(results.find(x=>x.status==='rejected').reason.code,'JOB_LOCKED');
  assert.deepEqual(await readdir(options.outputRoot),['carousel-1']);
});
it('refuse un verrou orphelin et permet une récupération explicite sans effacer la sortie',async t=>{
  const options=await fixture(t),job=spec();
  const stage='.carousel-1-attempt-abandoned';
  await mkdir(join(options.outputRoot,stage));
  await writeFile(join(options.outputRoot,stage,'partial'),'partial');
  await writeFile(join(options.outputRoot,'.carousel-1.lock'),JSON.stringify({schemaVersion:1,pid:2147483647,stage}));
  await assert.rejects(run(job,options),error=>error.code==='JOB_LOCKED');
  assert.equal(typeof api.recoverMediaJob,'function');
  await api.recoverMediaJob(job.id,{outputRoot:options.outputRoot});
  assert.deepEqual(await readdir(options.outputRoot),[]);
  await run(job,options);
  await writeFile(join(options.outputRoot,'.carousel-1.lock'),JSON.stringify({schemaVersion:1,pid:2147483647,stage}));
  await api.recoverMediaJob(job.id,{outputRoot:options.outputRoot});
  assert.equal((await run(job,options)).state,'reused');
  await writeFile(join(options.outputRoot,'.carousel-1.lock'),JSON.stringify({schemaVersion:1,pid:process.pid,stage}));
  await assert.rejects(api.recoverMediaJob(job.id,{outputRoot:options.outputRoot}),error=>error.code==='JOB_LOCKED');
});
it('CLI exige un manifeste et renvoie un échec structuré sans détails privés',async t=>{
  const invoke=args=>new Promise((ok,reject)=>{
    const child=spawn(process.execPath,args,{stdio:['ignore','pipe','pipe']});
    let stderr='';child.stderr.on('data',part=>stderr+=part);child.stdout.resume();
    child.on('error',reject);child.on('close',status=>ok({status,stderr}));
  });
  const cli=new URL('../src/run.mjs',import.meta.url).pathname;
  const empty=await invoke([cli]);
  assert.equal(empty.status,2);
  const options=await fixture(t);
  const invalid=join(options.root,'private-job.json');await writeFile(invalid,'invalid-json');
  const failure=await invoke([cli,invalid,options.inputRoot,options.outputRoot]);
  assert.equal(failure.status,1);
  assert.equal(JSON.parse(failure.stderr).success,false);
  assert.ok(!failure.stderr.includes(options.root));
});
it('la récupération refuse un enfant encore actif même si le propriétaire est mort',async t=>{
  const options=await fixture(t),stage='.carousel-1-attempt-live-worker';
  await mkdir(join(options.outputRoot,stage));
  await writeFile(join(options.outputRoot,stage,'partial'),'keep');
  await writeFile(join(options.outputRoot,'.carousel-1.lock'),JSON.stringify({schemaVersion:1,pid:2147483647,workerPid:process.pid,stage}));
  await assert.rejects(api.recoverMediaJob('carousel-1',{outputRoot:options.outputRoot}),error=>error.code==='JOB_LOCKED');
  assert.equal(await readFile(join(options.outputRoot,stage,'partial'),'utf8'),'keep');
});
it('la reprise refuse les fichiers inattendus et préserve les preuves existantes',async t=>{
  const options=await fixture(t),job=spec();await run(job,options);
  const unexpected=join(options.outputRoot,job.id,'media','private.txt');
  await writeFile(unexpected,'keep');
  await assert.rejects(run(job,options),error=>error.code==='OUTPUT_INVALID');
  assert.equal(await readFile(unexpected,'utf8'),'keep');
});
it('sérialise deux récupérations concurrentes du même verrou orphelin',async t=>{
  const options=await fixture(t),stage='.carousel-1-attempt-recover';
  await mkdir(join(options.outputRoot,stage));
  await writeFile(join(options.outputRoot,'.carousel-1.lock'),JSON.stringify({schemaVersion:1,pid:2147483647,stage}));
  const results=await Promise.allSettled([api.recoverMediaJob('carousel-1',options),api.recoverMediaJob('carousel-1',options)]);
  assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
  assert.equal(results.find(x=>x.status==='rejected').reason.code,'JOB_LOCKED');
  assert.deepEqual(await readdir(options.outputRoot),[]);
});
it('rejette une vidéo réelle de 61 secondes et un faux MP4 sans publication',async t=>{
  const options=await fixture(t),input=join(options.inputRoot,'long.mp4');
  const made=spawnSync('/usr/bin/ffmpeg',['-nostdin','-v','error','-f','lavfi','-i','color=c=red:s=16x16:r=1','-t','61','-c:v','mpeg4','-threads','1','-y',input],{timeout:15000});
  assert.equal(made.status,0,String(made.stderr));
  const job={schemaVersion:1,id:'long-video',kind:'video',inputs:[{path:'long.mp4'}]};
  await assert.rejects(run(job,options),error=>error.code==='PROCESS_FAILED');
  await writeFile(input,'not a video');
  await assert.rejects(run(job,options),error=>error.code==='PROCESS_FAILED');
  assert.deepEqual(await readdir(options.outputRoot),[]);
});
it('le schéma rejette les identifiants non textuels avec une erreur exploitable',async t=>{
  const options=await fixture(t);
  await assert.rejects(run({...spec(),id:123},options),error=>error.code==='JOB_INVALID');
  assert.deepEqual(await readdir(options.outputRoot),[]);
});
it('le décodeur réel ne reçoit ni secrets fournisseurs ni identifiants du processus parent',async t=>{
  if(process.platform!=='linux'){t.skip('Lecture de l’environnement du sous-processus via /proc sous Linux.');return;}
  const options=await fixture(t),sentinel='mc-secret-sentinelle-uniquement-test';
  const names=['OPENAI_API_KEY','SUPABASE_SERVICE_KEY','SUPABASE_SERVICE_ROLE_KEY','AWS_SECRET_ACCESS_KEY','STRIPE_SECRET_KEY','UPSTASH_REDIS_TOKEN'];
  const previous=new Map(names.map(name=>[name,process.env[name]]));
  for(const name of names)process.env[name]=sentinel;
  t.after(()=>{for(const [name,value]of previous){if(value===undefined)delete process.env[name];else process.env[name]=value;}});
  // Une vraie entrée augmente la fenêtre d’observation ; aucun décodeur de test ne remplace Sharp.
  await sharp({create:{width:4000,height:4000,channels:3,background:'red'}}).png().toFile(join(options.inputRoot,'a.png'));
  let evidence;
  const timer=setInterval(async()=>{
    if(evidence)return;
    try{
      const record=JSON.parse(await readFile(join(options.outputRoot,'.carousel-1.lock'),'utf8'));
      if(record.workerPid){
        const [env,args]=await Promise.all([readFile(`/proc/${record.workerPid}/environ`,'utf8'),readFile(`/proc/${record.workerPid}/cmdline`,'utf8')]);
        evidence={env,args};
      }
    }catch{/* Le journal peut être absent avant le démarrage ou après la fin du décodeur. */}
  },1);
  try{assert.equal((await run(spec(),options)).state,'completed');}finally{clearInterval(timer);}
  assert.ok(evidence,'Le processus enfant Sharp a été observé pendant son exécution.');
  assert.ok(evidence.env.includes('PATH=/usr/bin:/bin\0'));
  for(const name of names)assert.ok(!evidence.env.includes(name+'='),`${name} ne doit pas être transmis.`);
  assert.ok(!evidence.env.includes(sentinel));assert.ok(!evidence.args.includes(sentinel));
});
