// Recette de l'image : aucun réseau, aucune clé, vrais processeurs Sharp/FFmpeg.
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const {runMediaJob}=await import(pathToFileURL(resolve('workers/media-jobs/src/jobs.mjs')));
const root=await mkdtemp(join(process.env.MEDIA_RUNNER_WORK_ROOT??tmpdir(),'container-smoke-'));
try{
 const inputRoot=join(root,'inputs'),outputRoot=join(root,'outputs');await mkdir(inputRoot,{mode:0o700});await mkdir(outputRoot,{mode:0o700});
 for(const [name,color] of [['a.png','red'],['b.png','blue']])await sharp({create:{width:64,height:64,channels:3,background:color}}).png().toFile(join(inputRoot,name));
 const carousel={schemaVersion:1,id:'smoke-carousel',kind:'carousel',inputs:[{path:'a.png'},{path:'b.png'}]};
 const first=await runMediaJob(carousel,{inputRoot,outputRoot});assert.equal(first.state,'completed');assert.equal(first.result.aiCalls,0);
 assert.equal((await runMediaJob(carousel,{inputRoot,outputRoot})).state,'reused');
 const made=spawnSync('/usr/bin/ffmpeg',['-nostdin','-v','error','-f','lavfi','-i','color=c=blue:s=160x120:r=6','-f','lavfi','-i','sine=frequency=440:sample_rate=16000','-t','1','-c:v','mpeg4','-threads','1','-c:a','aac','-y',join(inputRoot,'clip.mp4')],{timeout:15000});
 assert.equal(made.status,0,'Génération FFmpeg impossible.');
 const video=await runMediaJob({schemaVersion:1,id:'smoke-video',kind:'video',inputs:[{path:'clip.mp4'}]},{inputRoot,outputRoot});
 assert.equal(video.result.artifacts.filter(a=>a.name.endsWith('.jpg')).length,3);
 assert.ok(video.result.artifacts.some(a=>a.name==='audio-mono.wav'));
 for(const result of [first.result,video.result])for(const artifact of result.artifacts){
  const bytes=await readFile(join(outputRoot,result.id,'media',artifact.name));
  assert.equal(bytes.length,artifact.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),artifact.sha256);
 }
 const disabled=spawnSync(process.execPath,['workers/media-jobs/src/remote-run.mjs'],{cwd:process.cwd(),env:{PATH:process.env.PATH,MEDIA_RUNNER_ENABLED:'false'},timeout:15000,encoding:'utf8'});
 assert.ifError(disabled.error);assert.equal(disabled.status,1);assert.deepEqual(JSON.parse(disabled.stderr.trim()),{state:'error',code:'RUNNER_UNAVAILABLE'});
 console.log(JSON.stringify({carousel:true,videoFrames:3,audio:true,hashes:true,reuse:true,disabledGate:true,aiCalls:0}));
}finally{await rm(root,{recursive:true,force:true});}
