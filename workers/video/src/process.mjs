#!/usr/bin/env node
// CLI privée, pas de réseau, aucune API IA. Nécessite FFprobe et FFmpeg installés.
import {spawn} from 'node:child_process';
import {createReadStream} from 'node:fs';
import {mkdtemp,rename,rm,stat,lstat,realpath,open,unlink,writeFile} from 'node:fs/promises';
import {join,resolve,extname,basename,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {validateProbe,sampleTimes,VideoInputError} from './validation.mjs';
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

export async function command(binary,args,timeout=15000){
  if(!['ffprobe','ffmpeg'].includes(binary))throw new VideoInputError('Outil refusé');
  return new Promise((ok,fail)=>{
    let output='';
    const child=spawn(binary,args,{shell:false,stdio:['ignore','pipe','pipe']});
    let timedOut=false;
    let settled=false;
    const finish=(error,value)=>{
      if(settled)return;
      settled=true;
      clearTimeout(timer);
      if(error)fail(error);else ok(value);
    };
    const timer=setTimeout(()=>{
      timedOut=true;
      child.kill('SIGKILL');
    },timeout);
    child.stdout.on('data',chunk=>{
      if(Buffer.byteLength(output)<90000)output+=String(chunk).slice(0,90000-Buffer.byteLength(output));
    });
    child.stderr.resume();
    child.on('error',()=>finish(new VideoInputError('Outil indisponible')));
    child.on('close',code=>{
      if(timedOut)return finish(new VideoInputError('Délai extraction dépassé'));
      if(code===0)finish(null,output);
      else finish(new VideoInputError('Extraction interrompue'));
    });
  });
}
async function digest(path){
  const hash=createHash('sha256');
  for await(const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}
// Publication dans un répertoire temporaire du même système de fichiers,
// puis rename unique : pas d'archive partielle visible en cas d'arrêt brusque.
// Verrou exclusif pour les processus coopérants. Ne jamais effacer un dossier
// préexistant ni tenter d'activer cette CLI comme service HTTP sur Cloudflare.
async function assertDestinationAbsent(destination) {
  try {
    await lstat(destination);
  } catch (error) {
    if(error?.code === 'ENOENT') return;
    throw error;
  }
  throw new VideoInputError('Répertoire de sortie déjà présent.');
}

export async function processVideo(source,destination){
  const input=resolve(source);
  const inputInfo=await lstat(input);
  if(!inputInfo.isFile() || inputInfo.isSymbolicLink() ||
      !['.mp4','.mov'].includes(extname(input).toLowerCase()) ||
      inputInfo.size<1 || inputInfo.size>MAX_VIDEO_BYTES)
    throw new VideoInputError('Fichier vidéo local MP4/MOV limité à 50 Mio.');
  const parent=await realpath(dirname(resolve(destination)));
  const out=join(parent,basename(resolve(destination)));
  await assertDestinationAbsent(out);
  const lockPath=out+'.lock';
  let lock;
  let stage;
  try {
    try {
      lock=await open(lockPath,'wx',0o600);
    } catch(error) {
      if(error?.code==='EEXIST') throw new VideoInputError('Traitement déjà en cours.');
      throw error;
    }
    await assertDestinationAbsent(out);
    const raw=await command('ffprobe',['-v','error','-protocol_whitelist','file,pipe',
      '-show_format','-show_streams','-of','json',input]);
    let parsed;
    try { parsed=JSON.parse(raw); }
    catch { throw new VideoInputError('Métadonnées vidéo illisibles.'); }
    const video=validateProbe(parsed,inputInfo.size);
    stage=await mkdtemp(join(parent,'.mc-video-stage-'));
    const frames=[];
    let audio=null;
    for(const [i,time] of sampleTimes(video.durationSeconds).entries()){
      const name='frame-'+String(i+1).padStart(2,'0')+'.jpg';
      const path=join(stage,name);
      await command('ffmpeg',['-nostdin','-v','error','-protocol_whitelist','file,pipe','-i',input,
        '-ss',String(time),'-map','0:v:0','-an','-sn','-vf',
        // La dernière image peut précéder le point demandé à faible cadence.
        // Prolonger cette image permet d'échantillonner toute la durée déclarée.
        'tpad=stop_mode=clone:stop_duration=1,scale=640:-2:force_original_aspect_ratio=decrease',
        '-frames:v','1','-threads','1','-y',path],20000);
      const file=await stat(path);
      if(!file.size || file.size>2*1024*1024) throw new VideoInputError('Image extraite invalide.');
      frames.push({name,atSeconds:time,sha256:await digest(path),bytes:file.size});
    }
    if(video.hasAudio){
      const name='audio-mono.wav',path=join(stage,name);
      await command('ffmpeg',['-nostdin','-v','error','-protocol_whitelist','file,pipe','-i',input,
        '-map','0:a:0','-vn','-sn','-ac','1','-ar','16000','-c:a','pcm_s16le',
        '-t',String(video.durationSeconds),'-threads','1','-y',path],20000);
      const size=(await stat(path)).size;
      if(!size || size>3*1024*1024) throw new VideoInputError('Piste audio invalide.');
      audio={name,bytes:size,sha256:await digest(path)};
    }
    const report={schemaVersion:2,aiCalls:0,video:{...video,sha256:await digest(input)},
      frames,audio,notice:'Extraction technique, ni transcription ni certification'};
    await writeFile(join(stage,'manifest.json'),JSON.stringify(report,null,2),
      {flag:'wx',mode:0o600});
    // Le dossier publié devient visible en une opération atomique uniquement
    // après que les frames, l'audio et le manifeste sont présents.
    await assertDestinationAbsent(out);
    await rename(stage,out);
    stage=undefined;
    return report;
  } finally {
    if(stage) await rm(stage,{recursive:true,force:true});
    if(lock) {
      await lock.close();
      await unlink(lockPath).catch(error=>{
        if(error?.code!=='ENOENT') throw error;
      });
    }
  }
}
if(process.argv[1]&&basename(process.argv[1])==='process.mjs'){
  const [source,out]=process.argv.slice(2);
  if(!source||!out){process.stderr.write('Usage: node process.mjs video.mp4 sortie\n');process.exitCode=2}
  else processVideo(source,out)
    .then(report=>process.stdout.write(JSON.stringify({success:true,aiCalls:0,
      frames:report.frames.length})+'\n'))
    .catch(()=>{process.stderr.write('Extraction vidéo échouée.\n');process.exitCode=1});
}
