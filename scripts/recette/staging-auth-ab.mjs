// Recette A/B réellement authentifiée ; exclusivement staging, sans appel IA/paiement.
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const url='https://ukvgnkxgzyhswgpnvyzz.supabase.co';
const web='https://mentioncheck-staging.toto-rina47501.workers.dev';
assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL,url);
assert.equal(process.env.NEXT_PUBLIC_APP_URL,web);
for(const [k,v] of Object.entries({
 OPENAI_PAUSED:'true',OPENAI_TEXT_ENABLED:'false',OPENAI_VISION_ENABLED:'false',
 OPENAI_AUDIO_ENABLED:'false',OPENAI_EMBEDDINGS_ENABLED:'false',BILLING_ENABLED:'false',
 MEDIA_PROCESSING_ENABLED:'false',MEDIA_AI_ENABLED:'false',MEDIA_RETENTION_ENABLED:'false'
}))assert.equal(process.env[k],v,'Refus coupe-circuit: '+k);
const anonKey=process.env.MENTIONCHECK_STAGING_SUPABASE_ANON_KEY;
const secretKey=process.env.MENTIONCHECK_STAGING_SUPABASE_SERVICE_KEY;
assert.ok(anonKey && secretKey,'Secrets staging manquants');
const opts={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const admin=createClient(url,secretKey,opts);
const a=createClient(url,anonKey,opts),b=createClient(url,anonKey,opts);
const run=randomUUID();
const users=[];
let objectPath=null;
function must(r,label) {
 if(r.error)throw new Error(label+': '+(r.error.code||'API_ERROR'));
 return r.data;
}
async function createActor(letter,client) {
 const email='qa-'+run+'-'+letter+'@example.test';
 const password='Qa-'+randomBytes(24).toString('base64url')+'!aA9';
 const u=must(await admin.auth.admin.createUser({
   email,password,email_confirm:true,app_metadata:{staging_recette:run}
 }),'CREATE_'+letter).user;
 assert.ok(u?.id,'Utilisateur sans identifiant');
 users.push(u.id);
 const login=must(await client.auth.signInWithPassword({email,password}),'LOGIN_'+letter);
 assert.equal(login.user?.id,u.id);
 assert.ok(login.session?.access_token);
 assert.equal(must(await client.auth.getUser(),'GETUSER_'+letter).user?.id,u.id);
 const profile=must(await admin.from('users').select('id').eq('id',u.id),'PROFILE_'+letter);
 if(!profile.length)must(await admin.from('users').insert({id:u.id,email}),'PROFILE_CREATE_'+letter);
 return u.id;
}
async function seed(table,value) {
 return must(await admin.from(table).insert(value).select('id').single(),'SEED_'+table).id;
}
async function ownership(table,id) {
 const ra=must(await a.from(table).select('id').eq('id',id),'A_'+table);
 const rb=must(await b.from(table).select('id').eq('id',id),'B_'+table);
 assert.equal(ra.length,0,'Fuite de lecture: '+table);
 assert.equal(rb.length,1,'Propriétaire bloqué: '+table);
}
async function cleanup() {
 const errs=[];
 if(objectPath) {
   const r=await admin.storage.from('verification-media').remove([objectPath]);
   if(r.error)errs.push('storage');
 }
 for(const id of [...users].reverse()) {
   const r=await admin.auth.admin.deleteUser(id);
   if(r.error)errs.push('auth');
 }
 if(errs.length)throw new Error('NETTOYAGE_INCOMPLET: '+errs.join(','));
 if(users.length) {
   const rows=must(await admin.from('users').select('id').in('id',users),'POST_CLEANUP');
   assert.equal(rows.length,0,'Profils de test restants');
 }
 console.log('RECETTE_NETTOYAGE_OK');
}
let failure=null;
try{
 const page=await fetch(web+'/login',{signal:AbortSignal.timeout(15000)});
 assert.equal(page.status,200,'Page de connexion indisponible');
 const guest=await fetch(web+'/api/mia/conversations',{redirect:'manual',signal:AbortSignal.timeout(15000)});
 assert.ok([401,403].includes(guest.status),'Conversation accessible sans connexion');
 console.log('HTTP_GUEST_OK');
 const aid=await createActor('a',a),bid=await createActor('b',b);
 console.log('AUTH_GOTRUE_AB_OK');
 const f={
  verifications:await seed('verifications',{user_id:bid,platform:'instagram',content_text:'Recette factice '+run}),
  media_assets:await seed('media_assets',{user_id:bid,kind:'image',storage_path:bid+'/test-'+run+'.png',mime_type:'image/png',declared_bytes:68}),
  assistant_conversations:await seed('assistant_conversations',{user_id:bid,messages:[]}),
  brand_deals:await seed('brand_deals',{user_id:bid,brand_name:'Recette Staging',start_date:'2026-11-08'}),
  social_accounts:await seed('social_accounts',{user_id:bid,platform:'instagram',handle:'staging-'+run})
 };
 await ownership('users',bid);
 for(const [table,id] of Object.entries(f))await ownership(table,id);
 assert.equal(must(await b.from('users').select('id').eq('id',aid),'RLS_INVERSE').length,0);
 console.log('RLS_6_TABLES_AB_OK');
 const rpc=[
  ['archive_brand_deal',{p_id:f.brand_deals}],
  ['delete_brand_deal_draft',{p_id:f.brand_deals}],
  ['remove_social_account',{p_id:f.social_accounts}],
  ['save_social_account',{p_id:f.social_accounts,p_platform:'instagram',p_handle:'interdit'}],
  ['save_brand_deal',{p_id:f.brand_deals,p_brand_name:'Interdit',p_start_date:'2026-11-08',
                       p_end_date:null,p_contract_url:null,p_verification_ids:[]}]
 ];
 for(const [name,args] of rpc) {
   const r=await a.rpc(name,args);
   assert.equal(r.error?.code,'P0002','RPC intercompte non refusée: '+name);
 }
 console.log('RPC_5_INTERCOMPTE_REFUSES_OK');
 const image=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO0CLa8AAAAASUVORK5CYII=','base64');
 const path=bid+'/qa-'+run+'.png';
 must(await b.storage.from('verification-media').upload(path,image,{contentType:'image/png',upsert:false}),'UPLOAD_B');
 objectPath=path;
 const own=must(await b.storage.from('verification-media').download(path),'DOWNLOAD_B');
 assert.equal((await own.arrayBuffer()).byteLength,image.length);
 assert.ok((await a.storage.from('verification-media').download(path)).error,'Compte A voit objet B');
 assert.ok((await a.storage.from('verification-media').createSignedUrl(path,30)).error,'Compte A signe objet B');
 const direct=a.storage.from('verification-media').getPublicUrl(path).data.publicUrl;
 assert.notEqual((await fetch(direct,{signal:AbortSignal.timeout(15000)})).status,200,'Objet public');
 console.log('STORAGE_PRIVEE_AB_OK');
 must(await a.auth.signOut(),'LOGOUT_A');
 must(await b.auth.signOut(),'LOGOUT_B');
 assert.equal((await a.auth.getSession()).data.session,null);
 assert.equal((await b.auth.getSession()).data.session,null);
 console.log('DECONNEXION_AB_OK');
} catch(e){failure=e;} finally{
 try{await cleanup();}catch(e){failure=failure?new Error(failure.message+'; '+e.message):e;}
}
if(failure)throw failure;
console.log('RECETTE_STAGING_PASS : Auth reelle, RLS/RPC, storage, logout ; zero appel IA');
