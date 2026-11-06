// Même lecture bornée pour l'aperçu opérateur et le traitement du Worker.
import { createAdminSupabase } from '@/lib/supabase/admin';
import { readCorpusPages } from '@/lib/mia/corpus-pages.mjs';
import { planLawIndex,LAW_EMBEDDING_MODEL } from '@/lib/mia/index-plan.mjs';
export async function readLawIndexPlan(admin:ReturnType<typeof createAdminSupabase>) {
 const rows=await readCorpusPages(async(offset,size)=>await admin.from('law_documents')
  .select('id,article_ref,content,source_url',{count:'exact'}).order('article_ref',{ascending:true})
  .range(offset,offset+size-1));
 // Le filtre serveur évite de transporter tous les vecteurs sur le Worker.
 const indexed=await readCorpusPages(async(offset,size)=>await admin.from('law_documents')
  .select('article_ref,embedding_model',{count:'exact'}).not('embedding','is',null)
  .eq('embedding_model',LAW_EMBEDDING_MODEL).order('article_ref',{ascending:true})
  .range(offset,offset+size-1));
 return planLawIndex(rows,indexed);
}
