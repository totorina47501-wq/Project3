import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { migrationForOffline } from './test-sql-offline.mjs';

test('seules les trois déclarations vectorielles initiales sont omises', async()=>{
  const sql=await readFile(new URL('../supabase/migrations/202611032001_initial_schema.sql',import.meta.url),'utf8');
  const adapted=migrationForOffline('202611032001_initial_schema.sql',sql);
  assert.ok(adapted.sql.includes('create table public.brand_deals'));
  assert.ok(adapted.sql.includes('create table public.law_documents'));
  assert.ok(adapted.sql.includes('create extension if not exists pgcrypto'));
  assert.ok(!adapted.sql.includes('extensions.vector'));
  assert.equal(adapted.omissions.length,3);
});
test('la migration pgvector reste explicitement non testée',()=>{
  const result=migrationForOffline('202611032003_pgvector_match.sql','contenu');
  assert.equal(result.sql,null);
  assert.equal(result.omissions.length,1);
});
test('les autres migrations restent identiques octet pour octet',()=>{
  const sql='begin; create table public.example(id uuid); commit;';
  assert.deepEqual(migrationForOffline('future_migration.sql',sql),{sql,omissions:[]});
});
test('une évolution du schéma initial bloque le harnais au lieu de masquer du SQL',()=>{
  assert.throws(()=>migrationForOffline('202611032001_initial_schema.sql','create table public.brand_deals(id uuid);'),/Déclaration vectorielle attendue/);
});
