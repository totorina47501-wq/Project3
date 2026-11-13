// PostgreSQL WASM privé en mémoire : aucun port, service distant ou donnée réelle.
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFile,readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const migrationDir=new URL('../supabase/migrations/',import.meta.url);
const regressionDir=new URL('../tests/sql/',import.meta.url);

const soloCutoverMigrations = [
  '20261110093000_free_vs_paid_solo_quotas.sql',
  '20261110170000_legacy_solo_promotion.sql',
  '20261111103000_legacy_solo_prelaunch_bridge.sql',
];

// Strictement limité aux trois migrations existantes : jamais un parseur SQL général.
export function soloCutoverBody(name, sql) {
  if (!soloCutoverMigrations.includes(name)) throw new Error('Migration hors lot Solo');
  const statements = sql.match(/^\s*(?:begin|commit|rollback)\s*;\s*$/gmi) ?? [];
  if (statements.length !== 2 || !/^\s*begin/i.test(statements[0]) || !/^\s*commit/i.test(statements[1])) {
    throw new Error('Enveloppe transactionnelle Solo inattendue');
  }
  const match = /^(?:\s*--[^\n]*\n)*\s*begin;([\s\S]*)\bcommit;\s*$/i.exec(sql);
  if (!match) throw new Error('Enveloppe transactionnelle Solo inattendue');
  return match[1];
}

// Répétition synthétique de transition, pas une restauration ni une recette distante.
export async function rehearseSoloCutover() {
  const db = new PGlite({extensions:{pgcrypto}});
  const actors = ['a3100000-0000-4000-8000-000000000001','a3100000-0000-4000-8000-000000000002'];
  try {
    await installSupabaseStubs(db);
    for (const name of (await readdir(migrationDir)).filter(n=>n.endsWith('.sql')).sort()) {
      if (soloCutoverMigrations.includes(name)) continue;
      const {sql}=migrationForOffline(name,await readFile(new URL(name,migrationDir),'utf8'));
      if (sql!==null) await db.exec(sql);
    }
    for (const [index,actor] of actors.entries()) await db.query(
      'insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[actor,`historical-${index}@example.test`]);
    const snapshot = async()=>JSON.stringify((await db.query(`select
      pg_get_functiondef('public.consume_usage_quota(uuid,text)'::regprocedure) as quota,
      (select proacl::text from pg_proc where oid='public.consume_usage_quota(uuid,text)'::regprocedure) as quota_acl,
      to_regclass('public.promotional_solo_access')::text as promotion,
      (select jsonb_agg(to_jsonb(u) order by id) from public.users u) as users,
      (select jsonb_agg(to_jsonb(s) order by user_id) from public.subscriptions s) as subscriptions,
      (select jsonb_agg(to_jsonb(u) order by user_id,period_start) from public.usage_monthly u) as usage`)).rows);
    const before = await snapshot();
    const bodies = await Promise.all(soloCutoverMigrations.map(async name=>soloCutoverBody(name,await readFile(new URL(name,migrationDir),'utf8'))));
    // Le même lot échoue volontairement après DDL/attribution, puis réussit avant ROLLBACK.
    for (const injectFailure of [true,false]) {
      await db.exec('begin; lock table public.users, public.subscriptions in share row exclusive mode;');
      let expectedFailure=false;
      try {
        await db.exec(bodies.join('\n'));
        await db.query(`insert into public.promotional_solo_access(user_id,starts_at,expires_at,activation_pending)
          select id,null,null,true from public.users where id=any($1::uuid[])`,[actors]);
        if (injectFailure) {
          await db.exec("do $$ begin raise exception 'synthetic_cutover_failure'; end $$;");
        }
        const {rows}=await db.query(`select count(*)::int as n from public.promotional_solo_access
          where activation_pending and starts_at is null and expires_at is null`);
        if (rows[0].n!==2) throw new Error('Deux droits pré-GO sans dates requis');
        const fresh='a3100000-0000-4000-8000-000000000003';
        await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[fresh,'new-free@example.test']);
        for (const actor of [...actors,fresh]) {
          for (const [action,limit] of [['check',actor===fresh?3:30],['rewrite',actor===fresh?1:5],['mia',actor===fresh?3:20]]) {
            for (let i=0;i<=limit;i++) {
              const {rows}=await db.query('select public.consume_usage_quota($1,$2) as ok',[actor,action]);
              if (rows[0].ok!==(i<limit)) throw new Error('Droits incorrects pendant cutover Solo');
            }
          }
        }
      } catch(error) {
        if (!injectFailure || !String(error.message).includes('synthetic_cutover_failure')) throw error;
        expectedFailure=true;
      } finally { await db.exec('rollback;'); }
      if (injectFailure&&!expectedFailure) throw new Error('Échec synthétique non observé');
      if (await snapshot()!==before) throw new Error('Rollback Solo incomplet : fonction, table, utilisateurs ou usage modifiés');
    }
  } finally { await db.close(); }
}

export function migrationForOffline(name,original) {
  if(name==='202611032003_pgvector_match.sql')return {
    sql:null,omissions:['Fonction match_law_documents et privilèges pgvector : non testés.'],
  };
  if(name==='20261110220000_social_oauth_vault_accounts.sql') {
    const extension='create extension if not exists supabase_vault with schema vault;';
    if(!original.includes(extension))throw new Error('Déclaration Vault attendue absente de la migration OAuth.');
    return {
      sql:original.replace(extension,''),
      omissions:['Chiffrement, clés et privilèges natifs de Supabase Vault remplacés par un stub éphémère.'],
    };
  }
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
    create schema vault;
    grant usage on schema auth to anon,authenticated,service_role;
    create table auth.users (
      id uuid primary key,
      email text,
      email_confirmed_at timestamptz
    );
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
    $$;
    create function auth.role() returns text language sql stable as $$
      select nullif(current_setting('request.jwt.claim.role',true),'')
    $$;
    create table vault.secrets (
      id uuid primary key default gen_random_uuid(),
      secret text not null,
      name text,
      description text
    );
    create view vault.decrypted_secrets as
      select id,secret as decrypted_secret from vault.secrets;
    create function vault.create_secret(p_secret text,p_name text default null,p_description text default null)
      returns uuid language plpgsql security definer set search_path='' as $$
      declare v_id uuid;
      begin
        insert into vault.secrets(secret,name,description)
        values(p_secret,p_name,p_description) returning id into v_id;
        return v_id;
      end
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
  await rehearseSoloCutover();
  console.log('Transition Solo atomique synthétique OK : 2 droits pré-GO, nouveau Gratuit, rollback DDL/données après échec et succès.');
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
    for(const name of ['studio_security.sql','settings_security.sql','social_oauth_security.sql','social_oauth_accounts_security.sql','collaborations_security.sql','privacy_regressions.sql','media_jobs_security.sql','ai_usage_security.sql','quota_period_security.sql','media_outputs_security.sql','law_controlled_import.sql','media_ai_security.sql','billing_sync_security.sql','free_paid_tiers_security.sql','legacy_solo_promotion_security.sql']) {
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
