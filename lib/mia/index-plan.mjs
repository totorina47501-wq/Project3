// Plan pur partagé par le Worker et le CLI ; cinq embeddings maximum par exécution.
export const MAX_INDEX_BATCH=5;
export const LAW_EMBEDDING_MODEL='text-embedding-3-small';
export function planLawIndex(rows,indexRows) {
 if(!Array.isArray(rows)||!Array.isArray(indexRows)||rows.length>1000)throw new Error('Corpus hors limites.');
 const refs=new Set();
 for(const row of rows) {
  let valid=false;
  try {const url=new URL(row.source_url);valid=url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&
    ['www.legifrance.gouv.fr','www.economie.gouv.fr'].includes(url.hostname)&&
    typeof row.content==='string'&&row.content.trim().length>=3&&row.content.length<=5000&&
    typeof row.article_ref==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(row.article_ref)&&
    typeof row.id==='string';}catch{ /* Source rejetée sans journaliser son contenu. */ }
  if(!valid||refs.has(row.article_ref))throw new Error('Corpus incomplet ou non validé.');
  refs.add(row.article_ref);
 }
 const indexed=new Set();
 for(const row of indexRows) {
  if(!refs.has(row.article_ref)||indexed.has(row.article_ref)||row.embedding_model!==LAW_EMBEDDING_MODEL)
   throw new Error('Couverture vectorielle incohérente.');
  indexed.add(row.article_ref);
 }
 const pending=rows.filter(row=>!indexed.has(row.article_ref));
 return {total:rows.length,indexed:indexed.size,pending,batch:pending.slice(0,MAX_INDEX_BATCH)};
}
