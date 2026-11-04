#!/usr/bin/env node
// Indexation explicite, idempotente et côté opérateur. Aucune requête payante sans --execute.
import { createClient } from '@supabase/supabase-js';

const MODEL = 'text-embedding-3-small';
const DIMENSIONS = 1536;
const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log('Usage: node scripts/mia/index-law-vectors.mjs [--execute]');
  console.log('Par défaut : aperçu sans appel OpenAI ni écriture.');
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
const { data, error, count } = await admin.from('law_documents')
  .select('id,article_ref,content,source_url,embedding,embedding_model', { count: 'exact' })
  .order('article_ref', { ascending: true }).limit(30);
if (error || !data || count !== data.length) throw new Error('Lecture du corpus incomplète.');
const valid = (row) => {
  try {
    const uri = new URL(row.source_url);
    return uri.protocol === 'https:' && !uri.username && !uri.password && !uri.port &&
      ['www.legifrance.gouv.fr', 'www.economie.gouv.fr'].includes(uri.hostname) &&
      typeof row.content === 'string' && row.content.trim().length >= 3 &&
      row.content.length <= 5000 &&
      typeof row.article_ref === 'string' &&
      /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(row.article_ref);
  } catch { return false; }
};
if (!data.every(valid)) throw new Error('Le corpus contient une entrée non validée : indexation annulée.');
const pending = data.filter((row) => row.embedding == null || row.embedding_model !== MODEL);
console.log(JSON.stringify({ mode: execute ? 'execute' : 'preview', total: data.length,
  alreadyIndexed: data.length - pending.length, pending: pending.length, model: MODEL }));
if (!execute || pending.length === 0) process.exit(0);
if (process.env.MIA_INDEX_APPROVED !== 'true' ||
    process.env.OPENAI_EMBEDDINGS_ENABLED !== 'true' ||
    process.env.OPENAI_PAUSED === 'true' || !process.env.OPENAI_API_KEY?.trim())
  throw new Error('Indexation payante non approuvée ou OpenAI désactivé.');
const { default: OpenAI } = await import('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 0, timeout: 30000 });
for (const row of pending) {
  const response = await openai.embeddings.create({
    model: MODEL, input: row.content.trim(), dimensions: DIMENSIONS,
  });
  const vector = response.data[0]?.embedding;
  if (!Array.isArray(vector) || vector.length !== DIMENSIONS || !vector.every(Number.isFinite))
    throw new Error('Réponse vectorielle OpenAI invalide.');
  const { data: updated, error: writeError } = await admin.from('law_documents')
    .update({ embedding: '[' + vector.join(',') + ']', embedding_model: MODEL })
    .eq('id', row.id).eq('content', row.content).select('id');
  if (writeError || updated?.length !== 1)
    throw new Error('Document modifié ou écriture refusée : indexation interrompue.');
  console.log(JSON.stringify({ articleRef: row.article_ref, indexed: true }));
}
console.log('Indexation terminée. Vérifier 5/5 dans Supabase avant MIA_VECTOR_SEARCH_ENABLED=true.');
