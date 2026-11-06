#!/usr/bin/env node
// Indexation explicite, idempotente et côté opérateur. Aucune requête payante sans --execute.
import { createClient } from '@supabase/supabase-js';
import { readCorpusPages } from '../../lib/mia/corpus-pages.mjs';
import { planLawIndex,MAX_INDEX_BATCH } from '../../lib/mia/index-plan.mjs';

const MODEL = 'text-embedding-3-small';
const DIMENSIONS = 1536;
const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log('Usage: node scripts/mia/index-law-vectors.mjs [--execute]');
  console.log('Par défaut : aperçu sans appel OpenAI ni écriture. Corpus limité à 1 000 sources ; cinq embeddings maximum par lot.');
  console.log('Pour indexer : MIA_INDEX_APPROVED=true OPENAI_EMBEDDINGS_ENABLED=true --execute.');
  process.exit(0);
}
if (args.some((arg) => arg !== '--execute') || args.filter((arg) => arg === '--execute').length > 1) {
  console.error('Option non reconnue. Utiliser --help.');
  process.exit(2);
}
const execute = args.includes('--execute');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) throw new Error('Accès Supabase administratif nécessaire, uniquement côté opérateur.');
const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const data = await readCorpusPages(async (offset,size) => await admin.from('law_documents')
  .select('id,article_ref,content,source_url', { count: 'exact' })
  .order('article_ref', { ascending: true }).range(offset,offset+size-1));
const indexRows = await readCorpusPages(async (offset,size) => await admin.from('law_documents')
  .select('article_ref,embedding_model', { count: 'exact' }).not('embedding','is',null)
  .eq('embedding_model',MODEL).order('article_ref',{ascending:true}).range(offset,offset+size-1));
const plan=planLawIndex(data,indexRows);
const {pending,batch}=plan;
console.log(JSON.stringify({ mode: execute ? 'execute' : 'preview', total: plan.total,
  alreadyIndexed: plan.indexed, pending: pending.length, batchSize: batch.length, maxBatch: MAX_INDEX_BATCH, model: MODEL }));
if (!execute || pending.length === 0) process.exit(0);
if (process.env.MIA_INDEX_APPROVED !== 'true' ||
    process.env.OPENAI_EMBEDDINGS_ENABLED !== 'true' ||
    process.env.OPENAI_PAUSED === 'true' || !process.env.OPENAI_API_KEY?.trim())
  throw new Error('Indexation payante non approuvée ou OpenAI désactivé.');
const { default: OpenAI } = await import('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 0, timeout: 30000 });
for (const row of batch) {
  const response = await openai.embeddings.create({
    model: MODEL, input: row.content.trim(), dimensions: DIMENSIONS,
  });
  const vector = response.data[0]?.embedding;
  if (!Array.isArray(vector) || vector.length !== DIMENSIONS || !vector.every(Number.isFinite))
    throw new Error('Réponse vectorielle OpenAI invalide.');
  const { data: updated, error: writeError } = await admin.from('law_documents')
    .update({ embedding: '[' + vector.join(',') + ']', embedding_model: MODEL })
    .eq('id', row.id).eq('content', row.content).eq('source_url',row.source_url).select('id');
  if (writeError || updated?.length !== 1)
    throw new Error('Document modifié ou écriture refusée : indexation interrompue.');
  console.log(JSON.stringify({ articleRef: row.article_ref, indexed: true }));
}
console.log(JSON.stringify({ indexed: batch.length, remaining: pending.length-batch.length,
  message:'Relancer explicitement les lots restants, puis vérifier la couverture complète avant MIA_VECTOR_SEARCH_ENABLED=true.' }));
