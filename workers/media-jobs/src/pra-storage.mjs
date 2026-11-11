// MentionCheck PRA Storage readback, opt-in and read-only. No network at import.
import {createHash} from 'node:crypto';

export const PRA_BUCKETS = Object.freeze([
  'deal-contracts','verification-media','verification-media-derived',
]);
const PROD_URL='https://zcztvberuihphqklhjsr.supabase.co';
const HEX=/^[a-f0-9]{64}$/i;
const FAIL=()=>{throw new Error('MC_PRA_STORAGE_BLOCKED');};
const positive=(value,max)=>/^[1-9]\d*$/.test(value??'') && Number.isSafeInteger(Number(value)) && Number(value)<=max;
const bounded=(value,max)=>/^\d+$/.test(value??'') && Number.isSafeInteger(Number(value)) && Number(value)<=max;

export function readPraStorageConfig(env={}){
  // These confirmations must be provided explicitly by a private operator.
  if(env.MC_PRA_STORAGE_ENABLED!=='true' || env.MC_PRA_INCLUDED_QUOTA_CONFIRMED!=='true') FAIL();
  if(env.CI || env.GITHUB_ACTIONS || env.DOCKER_HOST || env.DOCKER_CONTEXT) FAIL();
  if(env.MENTIONCHECK_PROD_POSTGRES_URL || env.MENTIONCHECK_STAGING_POSTGRES_URL) FAIL();
  if(env.SUPABASE_URL!==PROD_URL || !env.SUPABASE_SERVICE_KEY?.trim()) FAIL();
  if(!positive(env.MC_PRA_EXPECT_OBJECTS,100) ||
     !positive(env.MC_PRA_EXPECT_BYTES,16*1024*1024) ||
     !bounded(env.MC_PRA_EXPECT_MEDIA_HASHES,100)) FAIL();
  return {
    url:env.SUPABASE_URL,
    key:env.SUPABASE_SERVICE_KEY,
    expectedObjects:Number(env.MC_PRA_EXPECT_OBJECTS),
    expectedBytes:Number(env.MC_PRA_EXPECT_BYTES),
    expectedMediaHashes:Number(env.MC_PRA_EXPECT_MEDIA_HASHES),
  };
}

export async function verifyPraStorageReadback({client,expectedObjects,expectedBytes,expectedMediaHashes,signal}={}){
  if(!client || !Number.isSafeInteger(expectedObjects) || expectedObjects<1 || expectedObjects>100 ||
     !Number.isSafeInteger(expectedBytes) || expectedBytes<1 || expectedBytes>16*1024*1024 ||
     !Number.isSafeInteger(expectedMediaHashes) || expectedMediaHashes<0 || expectedMediaHashes>100) FAIL();
  const guard=()=>{if(signal?.aborted) FAIL();};
  const checked=async p=>{
    guard();
    let r;
    try{r=await p;}catch{FAIL();}
    guard();
    if(!r || r.error) FAIL();
    return r.data;
  };
  // Recheck before each bucket and before PASS. This remains a read-only
  // observation, NOT an atomic lock against a newly enqueued media job.
  // Future container exec must be serialized by the Cloudflare controller.
  const assertMediaIdle=async()=>{
    guard();
    let queue;
    try{
      queue=await client.from('media_processing_jobs')
        .select('id',{head:true,count:'exact'})
        .in('status',['queued','processing']);
    }catch{FAIL();}
    guard();
    if(!queue || queue.error || queue.count!==0) FAIL();
  };
  await assertMediaIdle();

  // Fail closed if a fourth bucket has appeared: a successful partial inventory is not proof.
  const buckets=await checked(client.storage.listBuckets());
  if(!Array.isArray(buckets) || buckets.length!==PRA_BUCKETS.length ||
    PRA_BUCKETS.some(b=>!buckets.some(x=>x.id===b && x.public===false))) FAIL();

  // Verify already stored SHA-256 values on user-uploaded original media.
  const assets=await checked(client.from('media_assets')
    .select('storage_path,media_sha256')
    .range(0,100));
  if(!Array.isArray(assets) || assets.length!==expectedMediaHashes) FAIL();
  const mediaHashes=new Map();
  for(const asset of assets){
    if(!asset || typeof asset.storage_path!=='string' ||
       !asset.storage_path || !HEX.test(asset.media_sha256??'') ||
       mediaHashes.has(asset.storage_path)) FAIL();
    mediaHashes.set(asset.storage_path,asset.media_sha256.toLowerCase());
  }

  let count=0,bytes=0,verifiedMediaHashes=0;
  const seen=new Set(),seenFolders=new Set();
  for(const name of PRA_BUCKETS){
    await assertMediaIdle();
    const result=await checked(client.storage.getBucket(name));
    if(!result || result.public!==false) FAIL();
    const bucket=client.storage.from(name);
    const prefixes=[''];
    while(prefixes.length){
      guard();
      if(prefixes.length>1000) FAIL();
      const prefix=prefixes.shift();
      if(seenFolders.has(name+'/'+prefix)) FAIL();
      seenFolders.add(name+'/'+prefix);
      let offset=0;
      while(true){
        guard();
        const records=await checked(bucket.list(prefix,{
          limit:100,offset,sortBy:{column:'name',order:'asc'},
        }));
        if(!Array.isArray(records) || records.length>100) FAIL();
        for(const item of records){
          const part=item?.name;
          if(typeof part!=='string' || !part || part==='.' || part==='..' ||
            part.includes('/') || part.includes('\\') || part.includes('\0')) FAIL();
          const full=prefix ? prefix+'/'+part:part;
          if(!item.id && !item.metadata){
            prefixes.push(full);
            continue;
          }
          if(!item.id || !item.metadata) FAIL();
          const itemSize=Number(item.metadata.size);
          if(!Number.isSafeInteger(itemSize) || itemSize<0 ||
            itemSize>expectedBytes || bytes+itemSize>expectedBytes) FAIL();
          if(seen.has(name+'/'+full) || ++count>expectedObjects) FAIL();
          seen.add(name+'/'+full);
          const blob=await checked(bucket.download(full));
          if(!blob || typeof blob.arrayBuffer!=='function' || blob.size!==itemSize) FAIL();
          let data;
          try{data=Buffer.from(await blob.arrayBuffer());}catch{FAIL();}
          guard();
          if(data.byteLength!==itemSize) FAIL();
          const hash=createHash('sha256').update(data).digest('hex');
          // No content, filenames, hashes or identifiers are returned/logged.
          data.fill(0);
          if(name==='verification-media' && mediaHashes.has(full)){
            if(mediaHashes.get(full)!==hash) FAIL();
            mediaHashes.delete(full);
            verifiedMediaHashes++;
          }
          bytes+=itemSize;
        }
        if(records.length<100) break;
        offset+=100;
        if(offset>expectedObjects+100) FAIL();
      }
    }
  }
  await assertMediaIdle();
  if(count!==expectedObjects || bytes!==expectedBytes ||
     verifiedMediaHashes!==expectedMediaHashes || mediaHashes.size!==0) FAIL();
  return Object.freeze({
    state:'STORAGE_READBACK_VERIFIED',
    objectCount:count,
    totalBytes:bytes,
    mediaHashesCompared:verifiedMediaHashes,
    databaseRestored:false,
    storageRestored:false,
    certification:'PARTIAL_READBACK_ONLY',
  });
}
