// PostgreSQL WASM privé en mémoire : aucun port, service distant ou donnée réelle.
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFile,readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const migrationDir=new URL('../supabase/migrations/',import.meta.url);
const regressionDir=new URL('../tests/sql/',import.meta.url);

export function migrationForOffline(name,original) {
  if(name==='202611032003_pgvector_match.sql')return {
    sql:null,omissions:['Fonction match_law_documents et privilèges pgvector : non testés.'],
  };
  if(name!=='202611032001_initial_schema.sql')return {sql:original,omissions:[]};
  const omissions=[];
  let sql=original;
  for(const [pattern,description] of [
    ['create extension if not exists vector with schema extensions;','Extension vector non disponible dans ce harnais.'],
    ['  embedding extensions.vector(1536),','Colonne embedding vector(1536) omise.'],
    [/create index law_documents_embedding_hnsw_idx\s+on public\.law_documents\s+using hnsw \(embedding extensions\.vector_cosine_ops\);/,'Index HNSW vectoriel omis.'],
  ]) {
    if(typeof pattern==='string'?!sql.includes(pattern):!pattern.test(sql)) {
      throw new Error('Déclaration vectorielle attendue absente du schéma initial : adapter explicitement le harnais.');
    }
    sql=sql.replace(pattern,'');
    omissions.push(description);
  }
  return {sql,omissions};
}

export async function installSupabaseStubs(db) {
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create schema auth;
    create schema storage;
    create schema extensions;
    grant usage on schema auth to anon,authenticated,service_role;
    create table auth.users (
      id uuid primary key,
      email text,
      email_confirmed_at timestamptz
    );
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
    $$;
    create table storage.buckets (
      id text primary key,name text,public boolean,
      file_size_limit bigint,allowed_mime_types text[]
    );
    create table storage.objects (
      id uuid primary key default gen_random_uuid(),
      bucket_id text,name text
    );
    alter table storage.objects enable row level security;
    create function storage.foldername(name text) returns text[] language sql as $$
      select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1]
    $$;
  `);
}

// Fabrique sans URL ni option de persistance : uniquement PostgreSQL en mémoire.
export async function createOfflineDatabase() {
  const db = new PGlite({extensions:{pgcrypto}});
  try {
    await installSupabaseStubs(db);
    for (const name of (await readdir(migrationDir)).filter(n=>n.endsWith('.sql')).sort()) {
      const {sql} = migrationForOffline(name,await readFile(new URL(name,migrationDir),'utf8'));
      if (sql !== null) await db.exec(sql);
    }
    return db;
  } catch (error) { await db.close(); throw error; }
}

export async function runSqlOffline() {
  const db=new PGlite({extensions:{pgcrypto}});
  const migrations=(await readdir(migrationDir)).filter(name=>name.endsWith('.sql')).sort();
  let applied=0;
  try {
    await installSupabaseStubs(db);
    console.log('PostgreSQL PGlite local en mémoire ; Auth/Storage simulés ; pgcrypto réel.');
    for(const name of migrations) {
      const original=await readFile(new URL(name,migrationDir),'utf8');
      const {sql,omissions}=migrationForOffline(name,original);
      for(const omission of omissions)console.log('OMISSION EXPLICITE : '+omission);
      if(sql===null)continue;
      try {await db.exec(sql);}catch(error) {
        throw new Error('Échec migration '+name+': '+(error instanceof Error?error.message:String(error)),{cause:error});
      }
      applied++;console.log('Migration OK : '+name);
    }
    for (const table of ['workspaces','user_preferences','brand_deal_verifications','privacy_consent_events','media_processing_jobs']) {
      const {rows}=await db.query('select to_regclass($1) is not null as present',['public.'+table]);
      if(!rows[0]?.present)throw new Error('Migration interne manquante pour '+table+'. Aucun SQL temporaire non versionné n’est exécuté.');
    }
    let suites=0;
    for(const name of ['studio_security.sql','settings_security.sql','collaborations_security.sql','privacy_regressions.sql','media_jobs_security.sql','ai_usage_security.sql','quota_period_security.sql','media_outputs_security.sql','law_controlled_import.sql','media_ai_security.sql','billing_sync_security.sql','free_paid_tiers_security.sql','legacy_solo_promotion_security.sql']) {
      try {await db.exec(await readFile(new URL(name,regressionDir),'utf8'));}catch(error) {
        throw new Error('Échec régression '+name+': '+(error instanceof Error?error.message:String(error)),{cause:error});
      }
      suites++;console.log('Régression SQL OK : '+name+' (transaction annulée)');
    }
    console.log(applied+' migrations appliquées ; '+suites+' suites SQL réussies. Aucune validation pgvector, Auth réel ou Storage réel.');
  }finally {await db.close();}
}

if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {await runSqlOffline();}catch(error) {
    console.error(error instanceof Error?error.message:error);
    process.exitCode=1;
  }
}
