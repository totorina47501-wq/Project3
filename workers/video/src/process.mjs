#!/usr/bin/env node
// CLI privée, pas de réseau, aucune API IA. Nécessite FFprobe et FFmpeg installés.
import {spawn} from 'node:child_process';
import {createReadStream} from 'node:fs';
import {mkdir,mkdtemp,rename,rm,stat,writeFile} from 'node:fs/promises';
import {join,resolve,extname,basename} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {validateProbe,sampleTimes,VideoInputError} from './validation.mjs';
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
      error?fail(error):ok(value);
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
      code===0?finish(null,output):finish(new VideoInputError('Extraction interrompue'));
    });
  });
}
async function digest(path){
  const hash=createHash('sha256');
  for await(const chunk of createReadStream(path))hash.update(chunk);
  return hash.digest('hex');
}
export async function processVideo(source,destination){
  const input=resolve(source),out=resolve(destination);
  const metadata=await stat(input);
  if(!metadata.isFile()||!['.mp4','.mov'].includes(extname(input).toLowerCase()))
    throw new VideoInputError('Fichier local MP4/MOV requis');
  const raw=await command('ffprobe',['-v','error','-protocol_whitelist','file,pipe',
    '-show_format','-show_streams','-of','json',input]);
  const video=validateProbe(JSON.parse(raw),metadata.size);
  const scratch=await mkdtemp(join(tmpdir(),'mc-video-'));
  const frames=[];let audio=null;
  let destinationCreated=false;
  let published=false;
  try{
    for(const [i,time] of sampleTimes(video.durationSeconds).entries()){
      const name='frame-'+String(i+1).padStart(2,'0')+'.jpg';
      const path=join(scratch,name);
      await command('ffmpeg',['-nostdin','-v','error','-protocol_whitelist','file,pipe','-i',input,
        '-ss',String(time),'-map','0:v:0','-an','-sn','-vf',
        'scale=640:-2:force_original_aspect_ratio=decrease',
        '-frames:v','1','-threads','1','-y',path],20000);
      const file=await stat(path);
      if(!file.size||file.size>2*1024*1024)throw new VideoInputError('Image invalide');
      frames.push({name,atSeconds:time,sha256:await digest(path)});
    }
    if(video.hasAudio){
      const name='audio-mono.wav',path=join(scratch,name);
      await command('ffmpeg',['-nostdin','-v','error','-protocol_whitelist','file,pipe','-i',input,
        '-map','0:a:0','-vn','-sn','-ac','1','-ar','16000','-c:a','pcm_s16le',
        '-t',String(video.durationSeconds),'-threads','1','-y',path],20000);
      audio={name,sha256:await digest(path)};
    }
    const report={schemaVersion:1,aiCalls:0,video:{...video,sha256:await digest(input)},
      frames,audio,notice:'Extraction technique, ni transcription ni certification'};
    await mkdir(out,{recursive:false,mode:0o700}); // Répertoire neuf obligatoire : ne pas écraser une preuve.
    destinationCreated=true;
    for(const item of [...frames,...(audio?[audio]:[])])
      await rename(join(scratch,item.name),join(out,item.name));
    await writeFile(join(out,'manifest.json'),JSON.stringify(report,null,2),
      {flag:'wx',mode:0o600});
    published=true;
    return report;
  }finally{
    // Ne nettoyer que le répertoire créé par cette exécution, jamais une preuve préexistante.
    if(destinationCreated&&!published)await rm(out,{recursive:true,force:true});
    await rm(scratch,{recursive:true,force:true});
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
