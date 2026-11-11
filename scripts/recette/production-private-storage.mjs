#!/usr/bin/env node
// Operator-only, private encrypted Storage archive and local bytes recovery.
// No public endpoint, no Cloudflare exec, no CI data export, no production writes.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {createClient} from '@supabase/supabase-js';
import {PRA_BUCKETS,readPraStorageLocalConfig,verifyPraStorageReadback} from
  '../../workers/media-jobs/src/pra-storage.mjs';

const FAIL=()=>{throw Error('MC_STORAGE_PRIVATE_BLOCKED');};
const SHA=/^[a-f0-9]{64}$/;
const PROJECT='zcztvberuihphqklhjsr';
const MAX=16*1024*1024;
const sha=data=>createHash('sha256').update(data).digest('hex');
const positive=(v,max)=>/^[1-9]\d*$/.test(v??'')&&Number.isSafeInteger(Number(v))&&Number(v)<=max;
const bounded=(v,max)=>/^\d+$/.test(v??'')&&Number.isSafeInteger(Number(v))&&Number(v)<=max;

function safePath(p,kind){
  if(typeof p!=='string'||!path.isAbsolute(p)) FAIL();
  const real=fs.realpathSync(p);
  const s=fs.lstatSync(real);
  if(s.isSymbolicLink()||(kind==='file'?!s.isFile():!s.isDirectory())||(s.mode&0o077)!==0) FAIL();
  const repo=path.resolve(import.meta.dirname,'../..');
  if(real===repo||real.startsWith(repo+path.sep)) FAIL();
  const git=spawnSync('git',['-C',kind==='file'?path.dirname(real):real,
    'rev-parse','--show-toplevel'],{encoding:'utf8',timeout:3000});
  if(git.status===0) FAIL();
  return real;
}
function localGuard(env){
  if(env.MC_PRA_LOCAL_STORAGE_ENABLED!=='true'||env.CI||env.GITHUB_ACTIONS||
     env.DOCKER_HOST||env.DOCKER_CONTEXT||
     env.MENTIONCHECK_PROD_POSTGRES_URL||env.MENTIONCHECK_STAGING_POSTGRES_URL) FAIL();
  if(!positive(env.MC_PRA_EXPECT_OBJECTS,100)||
     !positive(env.MC_PRA_EXPECT_BYTES,MAX)||
     !bounded(env.MC_PRA_EXPECT_MEDIA_HASHES,100)) FAIL();
  const work=safePath(env.MC_BACKUP_WORKDIR,'dir');
  const key=safePath(env.MC_BACKUP_AGE_IDENTITY,'file');
  if(work===path.dirname(key)) FAIL();
  return {work,key,counts:{
    objectCount:Number(env.MC_PRA_EXPECT_OBJECTS),
    totalBytes:Number(env.MC_PRA_EXPECT_BYTES),
    mediaHashesCompared:Number(env.MC_PRA_EXPECT_MEDIA_HASHES),
  }};
}
function runBinary(program,args,input){
  const r=spawnSync(program,args,{input,encoding:'buffer',maxBuffer:64*1024*1024,timeout:30000,
    stdio:['pipe','pipe','pipe']});
  if(r.error||r.status!==0||!Buffer.isBuffer(r.stdout)) FAIL();
  return r.stdout;
}
function storagePathOk(p){
  return typeof p==='string'&&p.length<=1024&&
    p.split('/').every(s=>s&&s!=='.'&&s!=='..'&&!s.includes('\\')&&!s.includes('\0'));
}
export function makeStorageArchive(records,counts){
  if(!Array.isArray(records)||!counts||records.length!==counts.objectCount||
     !Number.isSafeInteger(counts.totalBytes)||counts.totalBytes<1) FAIL();
  const seen=new Set();
  let bytes=0;
  const objects=records.map(r=>{
    if(!PRA_BUCKETS.includes(r.bucket)||!storagePathOk(r.path)||
       !Buffer.isBuffer(r.bytes)||!Number.isSafeInteger(r.size)||
       r.bytes.length!==r.size||!SHA.test(r.sha256)||sha(r.bytes)!==r.sha256) FAIL();
    const id=r.bucket+'/'+r.path;
    if(seen.has(id)) FAIL(); seen.add(id);
    bytes+=r.size;
    if(bytes>MAX) FAIL();
    return {bucket:r.bucket,path:r.path,size:r.size,sha256:r.sha256,
      bytesBase64:r.bytes.toString('base64')};
  });
  if(bytes!==counts.totalBytes) FAIL();
  return {format:'mentioncheck-storage-private-v1',project:PROJECT,
    count:counts.objectCount,totalBytes:counts.totalBytes,
    mediaHashesCompared:counts.mediaHashesCompared,objects};
}
export function restoreStorageArchive(manifest,counts,work){
  if(!manifest||manifest.format!=='mentioncheck-storage-private-v1'||
     manifest.project!==PROJECT||!Array.isArray(manifest.objects)||
     manifest.count!==counts.objectCount||manifest.totalBytes!==counts.totalBytes||
     manifest.mediaHashesCompared!==counts.mediaHashesCompared||
     manifest.objects.length!==counts.objectCount) FAIL();
  const root=fs.mkdtempSync(path.join(work,'mc-storage-'));
  let bytes=0,restored=0;
  const seen=new Set();
  try{
    fs.chmodSync(root,0o700);
    for(const r of manifest.objects){
      if(!r||!PRA_BUCKETS.includes(r.bucket)||!storagePathOk(r.path)||
         !Number.isSafeInteger(r.size)||r.size<0||!SHA.test(r.sha256)||
         typeof r.bytesBase64!=='string') FAIL();
      const identity=r.bucket+'/'+r.path;
      if(seen.has(identity)) FAIL();seen.add(identity);
      if(r.bytesBase64.length>Math.ceil(MAX*4/3)+4) FAIL();
      let data=Buffer.from(r.bytesBase64,'base64');
      try{
        if(data.toString('base64')!==r.bytesBase64||
           data.length!==r.size||sha(data)!==r.sha256) FAIL();
        bytes+=data.length;
        if(bytes>counts.totalBytes) FAIL();
        // No customer filename on disk, only numbered files in private temporary dir.
        const target=path.join(root,String(restored).padStart(4,'0'));
        fs.writeFileSync(target,data,{mode:0o600,flag:'wx'});
        const actual=fs.readFileSync(target);
        try{if(sha(actual)!==r.sha256) FAIL();}
        finally{actual.fill(0);}
        restored++;
      }finally{data.fill(0);}
    }
    if(bytes!==counts.totalBytes||restored!==counts.objectCount) FAIL();
    return {state:'LOCAL_STORAGE_BYTES_RECOVERED',objectsRestored:restored,
      bytesRestored:bytes,storageApiRestored:false,
      fullPraCertified:false};
  }finally{fs.rmSync(root,{recursive:true,force:true});}
}
async function main(){
  if(process.argv.length!==3) FAIL();
  const mode=process.argv[2];
  if(!['--backup-storage-local','--verify-storage-restore-local'].includes(mode)) FAIL();
  const env=process.env;
  const {work,key,counts}=localGuard(env);
  if(mode==='--backup-storage-local'){
    const cfg=readPraStorageLocalConfig(env);
    const dir=safePath(env.MC_BACKUP_DIR,'dir');
    const target=path.join(dir,'mentioncheck-storage-'+Date.now()+'.json.age');
    if(fs.existsSync(target)) FAIL();
    const objects=[];
    try{
      const controller=new AbortController();
      const t=setTimeout(()=>controller.abort(),120000);
      let result;
      try{
        const client=createClient(cfg.url,cfg.key,{
          auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
          global:{fetch:(input,init={})=>fetch(input,{...init,redirect:'error',
            signal:AbortSignal.any([controller.signal,AbortSignal.timeout(20000),
              ...(init.signal?[init.signal]:[]),
              ...(input instanceof Request?[input.signal]:[])]),
          })},
        });
        result=await verifyPraStorageReadback({
          client,signal:controller.signal,
          expectedObjects:cfg.expectedObjects,expectedBytes:cfg.expectedBytes,
          expectedMediaHashes:cfg.expectedMediaHashes,
          onVerifiedObject:async record=>objects.push(record),
        });
      }finally{clearTimeout(t);}
      if(result.objectCount!==counts.objectCount||
         result.totalBytes!==counts.totalBytes||
         result.mediaHashesCompared!==counts.mediaHashesCompared) FAIL();
      const manifest=makeStorageArchive(objects,counts);
      const plaintext=Buffer.from(JSON.stringify(manifest));
      try{
        const pub=runBinary('age-keygen',['-y',key],Buffer.alloc(0)).toString('utf8').trim();
        if(!/^age1[0-9a-z]+$/.test(pub)) FAIL();
        const encrypted=runBinary('age',['-r',pub],plaintext);
        try{
          // Prove encryption is recoverable before persisting any backup.
          const decoded=runBinary('age',['-d','-i',key],encrypted);
          try{if(sha(decoded)!==sha(plaintext)) FAIL();}
          finally{decoded.fill(0);}
          fs.writeFileSync(target,encrypted,{flag:'wx',mode:0o600});
          fs.chmodSync(target,0o600);
          console.log(JSON.stringify({state:'ENCRYPTED_STORAGE_ARCHIVE_CREATED',
            objects:counts.objectCount,bytes:counts.totalBytes,
            encryptedArchiveSha256:sha(encrypted),databaseRestored:false,
            storageRestored:false}));
        }finally{encrypted.fill(0);}
      }finally{plaintext.fill(0);}
    }finally{for(const o of objects)o.bytes.fill(0);}
    return;
  }
  const archive=safePath(env.MC_STORAGE_ENCRYPTED_ARCHIVE,'file');
  if(!archive.endsWith('.json.age')) FAIL();
  const encrypted=fs.readFileSync(archive);
  try{
    if(encrypted.length>64*1024*1024) FAIL();
    const decoded=runBinary('age',['-d','-i',key],encrypted);
    try{
      const manifest=JSON.parse(decoded.toString('utf8'));
      console.log(JSON.stringify(restoreStorageArchive(manifest,counts,work)));
    }finally{decoded.fill(0);}
  }finally{encrypted.fill(0);}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  try{await main();}catch{console.error('MC_STORAGE_PRIVATE_BLOCKED');process.exitCode=1;}
}
