// Transport privé injecté ; aucun accès réseau ni processus au simple import.
import {createHash,randomUUID} from 'node:crypto';
import {mkdir,writeFile,open,realpath} from 'node:fs/promises';
import {constants} from 'node:fs';
import {join} from 'node:path';
import {MediaJobError} from './jobs.mjs';
export const DERIVED_BUCKET='verification-media-derived';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const HEX=/^[a-f0-9]{64}$/;
const ARTIFACT=/^(frame-0[1-3]\.jpg|slide-0[1-5]\.webp|audio-mono\.wav|manifest\.json)$/;
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const failure=(code,message)=>{throw new MediaJobError(code,message);};
const mime=name=>name.endsWith('.jpg')?'image/jpeg':name.endsWith('.webp')?'image/webp':name.endsWith('.wav')?'audio/wav':'application/json';
export function createRemoteMediaQueue({client,inputRoot,outputRoot,signal}={}){
 let held;
 const guard=()=>{if(signal?.aborted)failure('CANCELLED','Traitement interrompu.');};
 // Une indisponibilité Storage ne prouve pas une corruption : la file reprend ces essais, avec son plafond et son délai SQL.
 const transfer=async(operation,source=false)=>{
  let response;
  try{response=await operation();}catch{guard();failure('PROCESS_FAILED','Transport privé indisponible.');}
  guard();
  if(response?.error){
   if(source&&Number(response.error.statusCode??response.error.status)===404)failure('INPUT_INVALID','Source privée invalide.');
   failure('PROCESS_FAILED','Transport privé indisponible.');
  }
  return response??{};
 };
 const readBytes=async blob=>{
  try{return Buffer.from(await blob.arrayBuffer());}catch{guard();failure('PROCESS_FAILED','Lecture privée indisponible.');}
 };
 const rpc=async(name,args)=>{const {data,error}=await client.rpc(name,args);if(error)failure('PROCESS_FAILED','File distante indisponible.');return data;};
 async function row(id){
  const {data,error}=await client.from('media_processing_jobs').select('user_id,status,lease_token,lease_until').eq('id',id).maybeSingle();
  if(error)failure('PROCESS_FAILED','Bail distant indisponible.');return data;
 }
 const active=(item,token)=>item?.status==='processing'&&item.lease_token===token&&Date.parse(item.lease_until)>Date.now();
 const queue={
  async claim(workerId){
   guard();if(!UUID.test(workerId))failure('JOB_INVALID','Identifiant de runner invalide.');
   const data=await rpc('media_job_claim',{p_worker:workerId});
   if(!Array.isArray(data)||data.length===0)return null;
   const lease=data[0];held={id:lease.id,leaseToken:lease.lease_token,job:lease.payload};
   try{
    const job=held.job;
    if(!UUID.test(held.id)||!UUID.test(held.leaseToken)||!job||job.id!==held.id||job.schemaVersion!==1||!['video','carousel'].includes(job.kind)||!Array.isArray(job.inputs)||
      (job.kind==='video'?job.inputs.length!==1:job.inputs.length<2||job.inputs.length>5))failure('JOB_INVALID','Réservation média invalide.');
    const owner=await row(held.id);
    if(!owner||!UUID.test(owner.user_id)||!active(owner,held.leaseToken))failure('CANCELLED','Bail expiré.');
    held.ownerId=owner.user_id;
    const seen=new Set();
    for(const input of job.inputs){
     const parts=typeof input?.path==='string'?input.path.split('/'):[];
     const name=parts[1]??'',dot=name.lastIndexOf('.');
     if(parts.length!==2||parts[0]!==held.ownerId||!UUID.test(name.slice(0,dot))||!HEX.test(input.sha256??'')||seen.has(input.path)||
       !(job.kind==='video'?['.mp4','.mov']:['.png','.jpg','.jpeg','.webp']).includes(name.slice(dot)))failure('INPUT_INVALID','Source privée invalide.');
     seen.add(input.path);
    }
    for(const input of job.inputs){
     guard();if(await queue.isCancelled(held.id,held.leaseToken))failure('CANCELLED','Bail expiré.');
     const {data:blob}=await transfer(()=>client.storage.from('verification-media').download(input.path),true);
     const max=job.kind==='video'?50*1024*1024:8*1024*1024;
     if(!blob||blob.size<1||blob.size>max)failure('INPUT_INVALID','Source privée invalide.');
     const bytes=await readBytes(blob);
     if(digest(bytes)!==input.sha256)failure('INPUT_INVALID','Source privée invalide.');
     guard();await mkdir(join(inputRoot,held.ownerId),{recursive:true,mode:0o700});
     await writeFile(join(inputRoot,input.path),bytes,{flag:'wx',mode:0o600});
    }
    return held;
   }catch(error){
    const code=error instanceof MediaJobError?error.code:'PROCESS_FAILED';
    await queue.fail(held.id,held.leaseToken,code);throw error instanceof MediaJobError?error:new MediaJobError('PROCESS_FAILED','Préparation privée indisponible.');
   }
  },
  async isCancelled(id,token){guard();return !active(await row(id),token);},
  async complete(id,token,result){
   guard();if(!held||id!==held.id||token!==held.leaseToken||await queue.isCancelled(id,token))return false;
   if(result?.id!==id||result.aiCalls!==0||!Array.isArray(result.artifacts)||result.artifacts.length<3||result.artifacts.length>7||
     new Set(result.artifacts.map(a=>a.name)).size!==result.artifacts.length)failure('OUTPUT_INVALID','Sorties privées invalides.');
   const prefix=`${held.ownerId}/${id}/${randomUUID()}`;
   const bucket=client.storage.from(DERIVED_BUCKET);
   for(const artifact of result.artifacts){
    guard();if(await queue.isCancelled(id,token))return false;
    if(!ARTIFACT.test(artifact?.name??'')||!HEX.test(artifact.sha256??'')||!Number.isSafeInteger(artifact.bytes)||artifact.bytes<1||artifact.bytes>8*1024*1024)
     failure('OUTPUT_INVALID','Sorties privées invalides.');
    const path=join(outputRoot,id,'media',artifact.name);
    if(await realpath(path)!==path)failure('OUTPUT_INVALID','Sorties privées invalides.');
    let handle,bytes;
    try{
     handle=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);
     const info=await handle.stat();if(!info.isFile()||info.size!==artifact.bytes)failure('OUTPUT_INVALID','Sorties privées invalides.');
     bytes=await handle.readFile();
    }finally{await handle?.close();}
    if(bytes.length!==artifact.bytes||digest(bytes)!==artifact.sha256)failure('OUTPUT_INVALID','Sorties privées invalides.');
    const key=`${prefix}/${artifact.name}`;
    await transfer(()=>bucket.upload(key,bytes,{upsert:false,contentType:mime(artifact.name),cacheControl:'0'}));
    guard();const {data:remote}=await transfer(()=>bucket.download(key));
    if(!remote||remote.size!==artifact.bytes||digest(await readBytes(remote))!==artifact.sha256)
     failure('OUTPUT_INVALID','Relecture privée incohérente.');
   }
   guard();if(await queue.isCancelled(id,token))return false;
   return await rpc('media_job_finish',{p_job:id,p_token:token,p_result:{...result,delivery:{bucket:DERIVED_BUCKET,prefix}}})===true;
  },
  fail:(id,token,code)=>rpc('media_job_fail',{p_job:id,p_token:token,p_code:['JOB_INVALID','INPUT_INVALID','OUTPUT_INVALID','JOB_CONFLICT','JOB_LOCKED','TIMEOUT','CANCELLED','PROCESS_FAILED'].includes(code)?code:'PROCESS_FAILED'}),
 };
 return queue;
}
