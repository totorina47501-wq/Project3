import {describe,it} from 'node:test';
import {strict as assert} from 'node:assert';
import {validateProbe,sampleTimes,VideoInputError} from '../src/validation.mjs';
const sample={format:{format_name:'mov,mp4',duration:'30'},
  streams:[{codec_type:'video',width:1080,height:1920},{codec_type:'audio'}]};
describe('FFprobe local sans crédits IA',()=>{
  it('accepte Reel 30s',()=>assert.equal(validateProbe(sample,10).hasAudio,true));
  it('rejette les noms de conteneurs trompeurs et inconnus',()=>{
    for(const format_name of ['notmp4','movicious','unknown','', 'avi,movicious']){
      assert.throws(()=>validateProbe({...sample,format:{...sample.format,format_name}},10),VideoInputError);
    }
  });
  it('accepte les formats MP4/MOV FFprobe séparés par virgules',()=>{
    for(const format_name of ['mov,mp4,m4a,3gp,3g2,mj2','mp4','mov']){
      assert.equal(validateProbe({...sample,format:{...sample.format,format_name}},10).width,1080);
    }
  });
  it('refuse les flux FFprobe absents ou malformés sans TypeError',()=>{
    for(const streams of [undefined,null,{},'video',[],[null],['video'],[{codec_type:'audio'}]]){
      assert.throws(()=>validateProbe({...sample,streams},10),VideoInputError);
    }
  });
  it('ignore les entrées nulles parmi les flux valides',()=>{
    assert.equal(validateProbe({...sample,streams:[null,...sample.streams]},10).hasAudio,true);
  });
  it('rejette les durées absentes, vides ou non numériques',()=>{
    for(const duration of [undefined,null,'','   ','NaN','Infinity',-1,0]){
      assert.throws(()=>validateProbe({...sample,format:{...sample.format,duration}},10),VideoInputError);
    }
  });
  it('rejette 61s',()=>assert.throws(()=>validateProbe({...sample,
    format:{format_name:'mp4',duration:'61'}},10),VideoInputError));
  it('rejette 50 Mo dépassés',()=>assert.throws(()=>validateProbe(sample,52428801),VideoInputError));
  it('rejette resolution extreme',()=>assert.throws(()=>validateProbe({...sample,
    streams:[{codec_type:'video',width:9000,height:1080}]},10),VideoInputError));
  it('rejette les durées sous 50 ms pour éviter les timestamps négatifs',()=>{ 
    for(const seconds of [0.001,0.009,0.01,0.049]){
      assert.throws(()=>sampleTimes(seconds),VideoInputError);
    }
    assert.ok(sampleTimes(0.05).every(t=>t>=0&&t<0.05));
  });
  it('calcule trois images sans sortir du média',()=>{
    const t=sampleTimes(1);
    assert.equal(t.length,3);
    assert.ok(t.every(x=>x>=0&&x<1));
  });
});


// Intégration locale : création d'une vidéo synthétique, sans Internet ni IA.
import {spawnSync} from 'node:child_process';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {processVideo,command} from '../src/process.mjs';
const ffmpegAvailable=spawnSync('ffmpeg',['-version'],{stdio:'ignore'}).status===0 &&
  spawnSync('ffprobe',['-version'],{stdio:'ignore'}).status===0;

it('extrait localement un MP4 synthétique et inscrit aiCalls=0',
  {skip:!ffmpegAvailable},async()=>{
    const root=await mkdtemp(join(tmpdir(),'mc-offline-test-'));
    const input=join(root,'video.mp4'),out=join(root,'outputs');
    try{
      const generated=spawnSync('ffmpeg',[
        '-hide_banner','-loglevel','error','-f','lavfi',
        '-i','testsrc=size=320x240:rate=6','-t','1',
        '-c:v','mpeg4','-pix_fmt','yuv420p','-y',input,
      ],{timeout:15000,stdio:'pipe'});
      assert.equal(generated.status,0,'Génération vidéo de test échouée.');
      const manifest=await processVideo(input,out);
      assert.equal(manifest.aiCalls,0);
      assert.equal(manifest.frames.length,3);
      assert.equal(manifest.audio,null);
      const disk=JSON.parse(await readFile(join(out,'manifest.json'),'utf8'));
      assert.equal(disk.video.width,320);
      assert.equal(disk.frames.length,3);
    }finally{await rm(root,{recursive:true,force:true})}
});

it('interrompt un processus FFmpeg trop long sans appel réseau', {skip:!ffmpegAvailable}, async()=>{
  await assert.rejects(
    command('ffmpeg',['-nostdin','-v','error','-re','-f','lavfi',
      '-i','testsrc=size=16x16:rate=1','-f','null','-'],100),
    error=>error instanceof VideoInputError && error.message==='Délai extraction dépassé'
  );
});
it('refuse un exécutable non autorisé',async()=>{
  await assert.rejects(command('curl',[]),VideoInputError);
});

it('préserve un répertoire de sortie préexistant sans écraser de preuve', {skip:!ffmpegAvailable}, async()=>{
  const root=await mkdtemp(join(tmpdir(),'mc-existing-output-'));
  const input=join(root,'video.mp4'),out=join(root,'existing');
  try{
    const generated=spawnSync('ffmpeg',[
      '-hide_banner','-loglevel','error','-f','lavfi',
      '-i','testsrc=size=320x240:rate=6','-t','1',
      '-c:v','mpeg4','-pix_fmt','yuv420p','-y',input,
    ],{timeout:15000,stdio:'pipe'});
    assert.equal(generated.status,0);
    const {mkdir,writeFile,readdir}=await import('node:fs/promises');
    await mkdir(out);
    await writeFile(join(out,'proof.txt'),'existing');
    await assert.rejects(processVideo(input,out),{code:'EEXIST'});
    assert.deepEqual(await readdir(out),['proof.txt']);
    assert.equal(await readFile(join(out,'proof.txt'),'utf8'),'existing');
  }finally{await rm(root,{recursive:true,force:true})}
});

it('verifie les empreintes SHA-256 du fichier et des trois images extraites', {skip:!ffmpegAvailable}, async()=>{
  const {createHash}=await import('node:crypto');
  const {createReadStream}=await import('node:fs');
  const root=await mkdtemp(join(tmpdir(),'mc-video-digest-'));
  const input=join(root,'source.mp4'),out=join(root,'result');
  const digest=async(path)=>{
    const hash=createHash('sha256');
    for await(const chunk of createReadStream(path))hash.update(chunk);
    return hash.digest('hex');
  };
  try{
    const generated=spawnSync('ffmpeg',[
      '-hide_banner','-loglevel','error','-f','lavfi',
      '-i','testsrc=size=160x120:rate=6','-t','1',
      '-c:v','mpeg4','-pix_fmt','yuv420p','-y',input,
    ],{timeout:15000,stdio:'pipe'});
    assert.equal(generated.status,0);
    const manifest=await processVideo(input,out);
    assert.equal(manifest.video.sha256,await digest(input));
    assert.match(manifest.video.sha256,/^[a-f0-9]{64}$/);
    for(const frame of manifest.frames){
      assert.equal(frame.sha256,await digest(join(out,frame.name)));
      assert.match(frame.sha256,/^[a-f0-9]{64}$/);
    }
    assert.equal(manifest.aiCalls,0);
    assert.equal(manifest.frames.length,3);
  }finally{await rm(root,{recursive:true,force:true});}
});
