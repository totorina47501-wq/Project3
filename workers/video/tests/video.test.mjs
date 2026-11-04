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
  it('rejette 61s',()=>assert.throws(()=>validateProbe({...sample,
    format:{format_name:'mp4',duration:'61'}},10),VideoInputError));
  it('rejette 50 Mo dépassés',()=>assert.throws(()=>validateProbe(sample,52428801),VideoInputError));
  it('rejette resolution extreme',()=>assert.throws(()=>validateProbe({...sample,
    streams:[{codec_type:'video',width:9000,height:1080}]},10),VideoInputError));
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
import {processVideo} from '../src/process.mjs';
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
