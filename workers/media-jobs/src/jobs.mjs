// Exécuteur local uniquement. Réutilise les processeurs Sharp/FFmpeg existants.
import {spawn} from 'node:child_process';
import {constants} from 'node:fs';
import {open,lstat,realpath,mkdir,mkdtemp,writeFile,readdir,rename,rm,unlink,chmod} from 'node:fs/promises';
import {join,resolve,extname,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const REVISION='mentioncheck-local-media-v1';
const HEX=/^[a-f0-9]{64}$/;
const ID=/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;
const MIB=1024*1024;
export class MediaJobError extends Error {
  constructor(code,message){super(message);this.name='MediaJobError';this.code=code;}
}
const fail=(code,message)=>{throw new MediaJobError(code,message);};
function object(value,keys){
  return value!==null && typeof value==='object' && !Array.isArray(value) &&
    Object.keys(value).every(key=>keys.includes(key));
}
function validateJob(job){
  if(!object(job,['schemaVersion','id','kind','inputs','timeoutMs']) || job.schemaVersion!==1 ||
    (typeof job.id!=='string'||!ID.test(job.id)) || !['video','carousel'].includes(job.kind) || !Array.isArray(job.inputs) ||
    (job.kind==='video' ? job.inputs.length!==1 : job.inputs.length<2 || job.inputs.length>5) ||
    (job.timeoutMs!==undefined && (!Number.isSafeInteger(job.timeoutMs)||job.timeoutMs<1||job.timeoutMs>120000)))
    fail('JOB_INVALID','Manifeste de job local invalide.');
  for(const input of job.inputs){
    if(!object(input,['path','sha256']) || typeof input.path!=='string' || input.path.length>1024 ||
      isAbsolute(input.path) || !input.path.split('/').every(part=>part && part!=='.' && part!=='..') ||
      /[\\:\u0000-\u001f]/.test(input.path) ||
      (input.sha256!==undefined && !HEX.test(input.sha256)))
      fail('JOB_INVALID','Chemin relatif local ou empreinte invalide.');
  }
  if(new Set(job.inputs.map(input=>input.path)).size!==job.inputs.length)
    fail('JOB_INVALID','Entrées dupliquées.');
}
async function exists(path){
  try{return await lstat(path);}catch(error){if(error.code==='ENOENT')return null;throw error;}
}
function hash(bytes){return createHash('sha256').update(bytes).digest('hex');}
async function boundedFile(path,max,code='OUTPUT_INVALID'){
  let handle;
  try{
    handle=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);
    const info=await handle.stat();
    if(!info.isFile()||info.size<1||info.size>max)fail(code,'Fichier absent ou hors limites.');
    const chunks=[],buffer=Buffer.allocUnsafe(Math.min(65536,max+1));
    let total=0;
    for(;;){
      const {bytesRead}=await handle.read(buffer,0,Math.min(buffer.length,max+1-total),null);
      if(bytesRead===0)break;
      total+=bytesRead;
      if(total>max)fail(code,'Fichier modifié pendant lecture.');
      chunks.push(Buffer.from(buffer.subarray(0,bytesRead)));
    }
    if(total!==info.size)fail(code,'Fichier modifié pendant lecture.');
    return Buffer.concat(chunks,total);
  }catch(error){if(error instanceof MediaJobError)throw error;fail(code,'Fichier local illisible.');}
  finally{await handle?.close();}
}
async function jsonFile(path,max=128*1024){
  try{return JSON.parse(await boundedFile(path,max));}
  catch(error){if(error instanceof MediaJobError)throw error;fail('OUTPUT_INVALID','Manifeste illisible.');}
}
function guard(signal,deadline){
  if(signal?.aborted)fail('CANCELLED','Job annulé.');
  if(Date.now()>=deadline)fail('TIMEOUT','Délai global dépassé.');
}
async function snapshot(job,inputRoot,stage,signal,deadline){
  const inputs=[];
  const sources=join(stage,'sources');await mkdir(sources,{mode:0o700});
  for(const [index,input] of job.inputs.entries()){
    guard(signal,deadline);
    const path=join(inputRoot,input.path);
    const info=await exists(path);
    const extensions=job.kind==='video'?['.mp4','.mov']:['.jpg','.jpeg','.png','.webp'];
    const max=job.kind==='video'?50*MIB:8*MIB;
    if(!info?.isFile() || info.isSymbolicLink() || !extensions.includes(extname(path).toLowerCase()) ||
      info.size<1||info.size>max || await realpath(path)!==path)
      fail('INPUT_INVALID','Entrée locale refusée ou trop volumineuse.');
    const bytes=await boundedFile(path,max,'INPUT_INVALID');
    guard(signal,deadline);
    const sha256=hash(bytes);
    if(input.sha256!==undefined && input.sha256!==sha256)
      fail('INPUT_INVALID','Empreinte source inattendue.');
    const name=String(index+1)+extname(path).toLowerCase();
    await writeFile(join(sources,name),bytes,{flag:'wx',mode:0o600});
    inputs.push({path:input.path,sha256,bytes:bytes.length,snapshot:name});
  }
  return inputs;
}
function fingerprint(job,inputs){
  return hash(JSON.stringify({revision:REVISION,kind:job.kind,
    inputs:inputs.map(({path,sha256,bytes})=>({path,sha256,bytes}))}));
}
async function execute(kind,inputs,stage,signal,deadline,onWorker){
  guard(signal,deadline);
  const entry=fileURLToPath(new URL('./processor-entry.mjs',import.meta.url));
  await new Promise((ok,reject)=>{
    const child=spawn(process.execPath,[entry,kind,join(stage,'media'),
      ...inputs.map(input=>join(stage,'sources',input.snapshot))],{
      shell:false,detached:process.platform!=='win32',stdio:['ignore','ignore','ignore','ipc'],
      // Aucun secret applicatif transmis ; les outils sont les binaires système.
      env:{PATH:'/usr/bin:/bin',HOME:stage,TMPDIR:stage,LANG:'C'},
    });
    let failure;
    const stop=code=>{
      failure ??= new MediaJobError(code,code==='CANCELLED'?'Job annulé.':'Délai global dépassé.');
      try{
        if(child.pid && process.platform!=='win32')process.kill(-child.pid,'SIGKILL');
        else child.kill('SIGKILL');
      }catch(error){if(error.code!=='ESRCH')child.kill('SIGKILL');}
    };
    const abort=()=>stop('CANCELLED');
    const timer=setTimeout(()=>stop('TIMEOUT'),Math.max(1,deadline-Date.now()));
    signal?.addEventListener('abort',abort,{once:true});
    if(signal?.aborted)abort();
    const clean=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);};
    child.once('spawn',()=>{
      onWorker(child.pid).then(()=>{if(!failure&&child.connected)child.send('start');}).catch(()=>{
        failure=new MediaJobError('PROCESS_FAILED','Écriture du journal impossible.');
        stop('PROCESS_FAILED');
      });
    });
    child.once('error',()=>{clean();reject(failure??new MediaJobError('PROCESS_FAILED','Processeur indisponible.'));});
    child.once('close',code=>{
      clean();
      if(failure)reject(failure);
      else if(code===0)ok();
      else reject(new MediaJobError('PROCESS_FAILED','Préparation technique échouée.'));
    });
  });
}
async function artifacts(media,kind,inputs){
  const info=await exists(media);
  if(!info?.isDirectory()||info.isSymbolicLink())fail('OUTPUT_INVALID','Répertoire média invalide.');
  const manifest=await jsonFile(join(media,'manifest.json'));
  let records;
  if(manifest.aiCalls!==0)fail('OUTPUT_INVALID','Manifeste technique invalide.');
  if(kind==='carousel'){
    if(manifest.schemaVersion!==1||manifest.processor!=='mentioncheck-carousel-offline-v1'||
      !Array.isArray(manifest.slides)||manifest.slides.length!==inputs.length)
      fail('OUTPUT_INVALID','Manifeste carrousel invalide.');
    records=manifest.slides.map((slide,index)=>{
      if(slide.position!==index+1 || slide.sourceSha256!==inputs[index].sha256 ||
        slide.outputFile!=='slide-'+String(index+1).padStart(2,'0')+'.webp')
        fail('OUTPUT_INVALID','Sources carrousel incohérentes.');
      return {name:slide.outputFile,bytes:slide.outputBytes,sha256:slide.outputSha256,max:8*MIB};
    });
  }else{
    if(manifest.schemaVersion!==2||manifest.video?.sha256!==inputs[0].sha256 ||
      !Number.isFinite(manifest.video.durationSeconds)||manifest.video.durationSeconds<0.05||manifest.video.durationSeconds>60||
      !Array.isArray(manifest.frames)||manifest.frames.length!==3||
      typeof manifest.video.hasAudio!=='boolean'||manifest.video.hasAudio!==!!manifest.audio)
      fail('OUTPUT_INVALID','Manifeste vidéo invalide.');
    records=manifest.frames.map((frame,index)=>{
      if(frame.name!=='frame-'+String(index+1).padStart(2,'0')+'.jpg'||
        !Number.isFinite(frame.atSeconds)||frame.atSeconds<0||frame.atSeconds>=manifest.video.durationSeconds)
        fail('OUTPUT_INVALID','Image vidéo invalide.');
      return {...frame,max:2*MIB};
    });
    if(manifest.audio){
      if(manifest.audio.name!=='audio-mono.wav')fail('OUTPUT_INVALID','Audio invalide.');
      records.push({...manifest.audio,max:3*MIB});
    }
  }
  const expected=['manifest.json',...records.map(record=>record.name)].sort();
  if(JSON.stringify((await readdir(media)).sort())!==JSON.stringify(expected))
    fail('OUTPUT_INVALID','Bundle incomplet ou fichiers inattendus.');
  const result=[];
  for(const record of records){
    const bytes=await boundedFile(join(media,record.name),record.max);
    if(!HEX.test(record.sha256??'') || bytes.length!==record.bytes || hash(bytes)!==record.sha256)
      fail('OUTPUT_INVALID','Octets de sortie altérés.');
    const valid=record.name.endsWith('.webp') ? bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'
      :record.name.endsWith('.jpg') ? bytes[0]===255&&bytes[1]===216&&bytes[2]===255
      :bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WAVE';
    if(!valid)fail('OUTPUT_INVALID','En-tête de sortie invalide.');
    result.push({name:record.name,bytes:bytes.length,sha256:record.sha256});
  }
  const bytes=await boundedFile(join(media,'manifest.json'),128*1024);
  result.push({name:'manifest.json',bytes:bytes.length,sha256:hash(bytes)});
  return result;
}
async function validatePublished(out,job,inputs,key){
  const info=await exists(out);
  if(!info?.isDirectory()||info.isSymbolicLink())fail('OUTPUT_INVALID','Destination existante invalide.');
  const result=await jsonFile(join(out,'result.json'));
  if(result.schemaVersion!==1||result.processor!==REVISION||result.id!==job.id||result.kind!==job.kind||
    result.fingerprint!==key)fail('JOB_CONFLICT','Identifiant déjà publié pour un autre contenu.');
  if(result.state!=='completed'||result.aiCalls!==0||JSON.stringify(result.inputs)!==JSON.stringify(inputs)||
    JSON.stringify((await readdir(out)).sort())!==JSON.stringify(['media','result.json']))
    fail('OUTPUT_INVALID','Résultat publié invalide.');
  const verified=await artifacts(join(out,'media'),job.kind,inputs);
  if(JSON.stringify(result.artifacts)!==JSON.stringify(verified))fail('OUTPUT_INVALID','Empreintes publiées incohérentes.');
  return result;
}
export async function runMediaJob(job,{inputRoot,outputRoot,signal}={}){
  validateJob(job);
  if(typeof inputRoot!=='string'||typeof outputRoot!=='string')fail('JOB_INVALID','Racines locales requises.');
  const deadline=Date.now()+(job.timeoutMs??120000);
  guard(signal,deadline);
  const root=await realpath(resolve(outputRoot)),sourceRoot=await realpath(resolve(inputRoot));
  const out=join(root,job.id),lockPath=join(root,'.'+job.id+'.lock');
  let lock,stage;
  try{
    if(await exists(join(root,'.'+job.id+'.recover')))fail('JOB_LOCKED','Récupération en cours.');
    try{lock=await open(lockPath,'wx',0o600);}
    catch(error){if(error.code==='EEXIST')fail('JOB_LOCKED','Job verrouillé ; récupération explicite requise.');throw error;}
    // Persister le propriétaire avant de créer un stage ; une interruption reste visible.
    await lock.writeFile(JSON.stringify({schemaVersion:1,pid:process.pid,stage:null}));
    stage=await mkdtemp(join(root,'.'+job.id+'-attempt-'));await chmod(stage,0o700);
    await lock.truncate(0);await lock.write(JSON.stringify({schemaVersion:1,pid:process.pid,stage:stage.slice(root.length+1)}),0,'utf8');
    const inputs=await snapshot(job,sourceRoot,stage,signal,deadline);
    const key=fingerprint(job,inputs);
    if(await exists(out)){
      const result=await validatePublished(out,job,inputs,key);guard(signal,deadline);
      return {state:'reused',directory:out,result};
    }
    await execute(job.kind,inputs,stage,signal,deadline,async workerPid=>{
      const record=JSON.stringify({schemaVersion:1,pid:process.pid,workerPid,stage:stage.slice(root.length+1)});
      await lock.truncate(0);await lock.write(record,0,'utf8');
    });
    guard(signal,deadline);
    const files=await artifacts(join(stage,'media'),job.kind,inputs);
    const result={schemaVersion:1,processor:REVISION,id:job.id,kind:job.kind,state:'completed',aiCalls:0,
      fingerprint:key,inputs,artifacts:files,notice:'Préparation technique locale, sans analyse IA ni transcription.'};
    await rm(join(stage,'sources'),{recursive:true});
    await writeFile(join(stage,'result.json'),JSON.stringify(result,null,2),{mode:0o600,flag:'wx'});
    guard(signal,deadline);
    if(await exists(out))fail('JOB_CONFLICT','Destination publiée par un autre programme.');
    await rename(stage,out);stage=undefined;
    return {state:'completed',directory:out,result};
  }finally{
    if(stage)await rm(stage,{recursive:true,force:true});
    if(lock){await lock.close();await unlink(lockPath);}
  }
}
export async function recoverMediaJob(id,{outputRoot}={}){
  if(typeof id!=='string'||!ID.test(id)||typeof outputRoot!=='string')fail('JOB_INVALID','Identifiant et racine requis.');
  const root=await realpath(resolve(outputRoot)),lockPath=join(root,'.'+id+'.lock');
  const recoveryPath=join(root,'.'+id+'.recover');
  let recovery;
  try{recovery=await open(recoveryPath,'wx',0o600);}
  catch(error){if(error.code==='EEXIST')fail('JOB_LOCKED','Récupération déjà en cours.');throw error;}
  try{
    await recovery.writeFile(JSON.stringify({pid:process.pid}));
    const bytes=await boundedFile(lockPath,4096),record=JSON.parse(bytes);
    if(record.schemaVersion!==1||!Number.isSafeInteger(record.pid)||record.pid<1 ||
      (record.workerPid!==undefined&&(!Number.isSafeInteger(record.workerPid)||record.workerPid<1)) ||
      (record.stage!==null && (typeof record.stage!=='string'||!record.stage.startsWith('.'+id+'-attempt-')||
        record.stage.includes('/')||record.stage.includes('\\'))))
      fail('JOB_LOCKED','Verrou non reconnu ; inspection opérateur requise.');
    try{process.kill(record.pid,0);fail('JOB_LOCKED','Processus propriétaire encore présent.');}
    catch(error){if(error.code!=='ESRCH')throw error;}
    if(record.workerPid){
      for(const pid of process.platform==='win32'?[record.workerPid]:[record.workerPid,-record.workerPid]){
        try{process.kill(pid,0);fail('JOB_LOCKED','Enfant ou groupe de traitement encore présent.');}
        catch(error){if(error.code!=='ESRCH')throw error;}
      }
    }
    // Vérifier à nouveau avant toute suppression : aucun remplacement de verrou accepté.
    if(!(await boundedFile(lockPath,4096)).equals(bytes))fail('JOB_LOCKED','Verrou modifié.');
    if(record.stage){
      const stage=join(root,record.stage),info=await exists(stage);
      if(info && (!info.isDirectory()||info.isSymbolicLink()||await realpath(stage)!==stage))
        fail('JOB_LOCKED','Stage non reconnu.');
      await rm(stage,{recursive:true,force:true});
    }
    await unlink(lockPath);
    return {state:'recovered',id};
  }finally{await recovery.close();await unlink(recoveryPath);}
}
