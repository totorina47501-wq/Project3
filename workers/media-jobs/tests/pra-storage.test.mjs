import {it} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readPraStorageConfig,verifyPraStorageReadback,PRA_BUCKETS} from '../src/pra-storage.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
function fixture({changed=false,additionalBucket=false,assets=1,busy=false}={}){
 const original=Buffer.from('private-fixture-no-personal-data');
 const expected=sha(original);
 const calls=[];
 const bucketData={
  'verification-media':[{name:'folder',id:null,metadata:null}],
  'verification-media/folder':[{name:'original.png',id:'object1',metadata:{size:original.length}}],
  'deal-contracts':[],
  'verification-media-derived':[],
 };
 const client={
  storage:{
   listBuckets:async()=>({data:[...PRA_BUCKETS.map(id=>({id,public:false})),
     ...(additionalBucket?[{id:'new-unknown',public:false}]:[])]}),
   getBucket:async id=>({data:{id,public:false}}),
   from:id=>({
    list:async(prefix,{offset})=>{
      calls.push('list:'+id+':'+prefix);
      return {data:(bucketData[id+(prefix?'/'+prefix:'')]??[]).slice(offset,offset+100)};
    },
    download:async path=>{
      calls.push('download:'+id+':'+path);
      const payload=changed?Buffer.from('tampered-bytes-fixture-only'):original;
      return {data:new Blob([payload])};
    },
  }),
  },
  from:table=>{
   if(table==='media_processing_jobs')return {select:()=>({in:async()=>({count:busy?1:0,error:null})})};
   assert.equal(table,'media_assets');
   return {select:()=>({range:async()=>({data:
     assets===1?[{storage_path:'folder/original.png',media_sha256:expected}]:[],
   })})};
  },
 };
 return {client,calls,size:original.length};
}
it('refuses by default without spending quota or reading secrets',()=>{
 assert.throws(()=>readPraStorageConfig({}),/MC_PRA_STORAGE_BLOCKED/);
 assert.throws(()=>readPraStorageConfig({MC_PRA_STORAGE_ENABLED:'true'}),/MC_PRA_STORAGE_BLOCKED/);
});
it('refuses CI, remote database DSNs and nonproduction target without echoing secrets',()=>{
 const base={MC_PRA_STORAGE_ENABLED:'true',MC_PRA_INCLUDED_QUOTA_CONFIRMED:'true',
   SUPABASE_URL:'https://zcztvberuihphqklhjsr.supabase.co',SUPABASE_SERVICE_KEY:'secret',
   MC_PRA_EXPECT_OBJECTS:'1',MC_PRA_EXPECT_BYTES:'32',MC_PRA_EXPECT_MEDIA_HASHES:'1'};
 for(const value of [
  {CI:'true'}, {GITHUB_ACTIONS:'true'},
  {MENTIONCHECK_PROD_POSTGRES_URL:'postgresql://secret:foo@prod'},
  {DOCKER_HOST:'tcp://docker.host:2375'},
  {SUPABASE_URL:'https://ukvgnkxgzyhswgpnvyzz.supabase.co'},
  {MC_PRA_EXPECT_BYTES:'9999999999'},
 ])assert.throws(()=>readPraStorageConfig({...base,...value}),/MC_PRA_STORAGE_BLOCKED/);
 const allowed=readPraStorageConfig(base);
 assert.equal(allowed.expectedObjects,1);
 assert.equal(allowed.expectedBytes,32);
});
it('re-hashes every private Storage byte, checks sizes, reports only aggregate data',async()=>{
 const f=fixture(),r=await verifyPraStorageReadback({
  client:f.client,expectedObjects:1,expectedBytes:f.size,expectedMediaHashes:1});
 assert.deepEqual(r,{
  state:'STORAGE_READBACK_VERIFIED',objectCount:1,totalBytes:f.size,
  mediaHashesCompared:1,databaseRestored:false,storageRestored:false,
  certification:'PARTIAL_READBACK_ONLY',
 });
 assert(f.calls.includes('download:verification-media:folder/original.png'));
 assert(!JSON.stringify(r).includes('original.png'));
});
it('fails closed on modified data, new bucket, missing expected objects, missing linked hashes',async()=>{
 for(const args of [
  [{changed:true},{expectedObjects:1,expectedMediaHashes:1}],
  [{additionalBucket:true},{expectedObjects:1,expectedMediaHashes:1}],
  [{},{expectedObjects:2,expectedMediaHashes:1}],
  [{assets:0},{expectedObjects:1,expectedMediaHashes:1}],
 ]){
  const f=fixture(args[0]);
  await assert.rejects(
   verifyPraStorageReadback({client:f.client,expectedObjects:args[1].expectedObjects,
      expectedBytes:f.size,expectedMediaHashes:args[1].expectedMediaHashes}),
   /MC_PRA_STORAGE_BLOCKED/,
  );
 }
});
it('refuses any remote transport failure and any cancellation',async()=>{
 const f=fixture();
 f.client.storage.listBuckets=async()=>({error:new Error('confidential-provider-error')});
 await assert.rejects(verifyPraStorageReadback({client:f.client,expectedObjects:1,expectedBytes:f.size,expectedMediaHashes:1}),
   /MC_PRA_STORAGE_BLOCKED/);
 const g=fixture(),controller=new AbortController();controller.abort();
 await assert.rejects(verifyPraStorageReadback({client:g.client,expectedObjects:1,expectedBytes:g.size,expectedMediaHashes:1,signal:controller.signal}),
   /MC_PRA_STORAGE_BLOCKED/);
});

it('does not read Storage when the existing media queue has pending work',async()=>{
 const f=fixture({busy:true});
 await assert.rejects(verifyPraStorageReadback({
   client:f.client,expectedObjects:1,expectedBytes:f.size,expectedMediaHashes:1,
 }),/MC_PRA_STORAGE_BLOCKED/);
 assert.equal(f.calls.length,0);
});
