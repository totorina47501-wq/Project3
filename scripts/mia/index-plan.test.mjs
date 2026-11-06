import { describe,it } from 'node:test';import assert from 'node:assert/strict';
import { planLawIndex,MAX_INDEX_BATCH } from '../../lib/mia/index-plan.mjs';
const rows=Array.from({length:35},(_,i)=>({id:String(i),article_ref:'TEST-'+i,content:'Texte fictif non juridique',source_url:'https://www.legifrance.gouv.fr/loda/id/TEST'}));
describe('index paginé et budget borné',()=>{
 it('accepte 35 textes et ne prépare que cinq appels pour les manquants',()=>{
  const result=planLawIndex(rows,rows.slice(0,27).map(row=>({article_ref:row.article_ref,embedding_model:'text-embedding-3-small'})));
  assert.equal(result.total,35);assert.equal(result.pending.length,8);assert.equal(result.batch.length,MAX_INDEX_BATCH);
 });
 it('ne réindexe rien quand la couverture est complète',()=>assert.equal(planLawIndex(rows,rows.map(row=>({article_ref:row.article_ref,embedding_model:'text-embedding-3-small'}))).batch.length,0));
 it('refuse les références dupliquées, des sources non fiables et les vecteurs inconnus',()=>{
  assert.throws(()=>planLawIndex([...rows,rows[0]],[]));
  assert.throws(()=>planLawIndex([{...rows[0],source_url:'https://www.legifrance.gouv.fr.evil.test/'}],[]));
  assert.throws(()=>planLawIndex(rows,[{article_ref:'absent',embedding_model:'text-embedding-3-small'}]));
 });
});
