// Exerce le RAG intégré à main ; tous les fournisseurs sont simulés.
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
const mocks=vi.hoisted(()=>({create:vi.fn(),embed:vi.fn(),rpc:vi.fn(),limit:vi.fn()}));
vi.mock('server-only',()=>({}));
vi.mock('../../lib/supabase/admin',()=>({createAdminSupabase:mocks.create}));
vi.mock('../../lib/openai/embeddings',()=>({generateLegalEmbedding:mocks.embed}));
import { retrieveLawSources } from '../../lib/mia/retrieval';
import { sourcesForCitations,type LawSource } from '../../lib/mia/ranking';
const records=[
  {article_ref:'A1',content:'Définition influence commerciale.',source_url:'https://www.legifrance.gouv.fr/loda/id/A1',effective_on:null,checked_at:null},
  {article_ref:'A2',content:'Publicité et collaboration : mention explicite.',source_url:'https://www.economie.gouv.fr/influence',effective_on:null,checked_at:null},
];
const vector=Array.from({length:1536},(_,index)=>index===0?1:0);
const corpus=()=>({data:records,error:null,count:2});
const indexed=()=>({data:records.map(row=>({...row,embedding:JSON.stringify(vector),embedding_model:'text-embedding-3-small'})),error:null,count:2});
function enable(){vi.stubEnv('MIA_VECTOR_SEARCH_ENABLED','true');vi.stubEnv('OPENAI_EMBEDDINGS_ENABLED','true');vi.stubEnv('OPENAI_PAUSED','false');vi.stubEnv('OPENAI_API_KEY','offline-fixture-never-used');}
beforeEach(()=>{
  vi.clearAllMocks();
  vi.stubEnv('MIA_VECTOR_SEARCH_ENABLED','false');vi.stubEnv('OPENAI_EMBEDDINGS_ENABLED','false');vi.stubEnv('OPENAI_PAUSED','true');vi.stubEnv('OPENAI_API_KEY','');
  mocks.limit.mockReset().mockResolvedValue(corpus());
  mocks.create.mockImplementation(()=>({from:()=>({select:()=>({order:()=>({limit:mocks.limit}),limit:mocks.limit})}),rpc:mocks.rpc}));
  mocks.embed.mockResolvedValue({vector,model:'text-embedding-3-small',tokens:0,estimatedCostUsd:0});
  mocks.rpc.mockResolvedValue({data:[{article_ref:'A1',source_url:records[0]!.source_url,similarity:.99,content:'Texte RPC ignoré'}],error:null});
  vi.spyOn(console,'warn').mockImplementation(()=>{});
});
afterEach(()=>{vi.unstubAllEnvs();vi.restoreAllMocks();});
describe('RAG existant et activation hors ligne contrôlée',()=>{
  it('reste lexical sans aucun embedding lorsque désactivé',async()=>{
    expect((await retrieveLawSources('Publicité'))[0]?.articleRef).toBe('A2');
    expect(mocks.embed).not.toHaveBeenCalled();expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('refuse un index partiel avant tout appel au fournisseur simulé',async()=>{
    enable();mocks.limit.mockResolvedValueOnce(corpus()).mockResolvedValueOnce({data:[{article_ref:'A1',embedding:null,embedding_model:null}],count:1,error:null});
    expect((await retrieveLawSources('Publicité'))[0]?.articleRef).toBe('A2');expect(mocks.embed).not.toHaveBeenCalled();
  });
  it('utilise la RPC existante et retourne uniquement le corpus validé',async()=>{
    enable();mocks.limit.mockResolvedValueOnce(corpus()).mockResolvedValueOnce(indexed());
    const sources=await retrieveLawSources('Question sans correspondance');
    expect(mocks.embed).toHaveBeenCalledOnce();expect(mocks.rpc).toHaveBeenCalledWith('match_law_documents',{query_embedding:JSON.stringify(vector),match_count:5,min_similarity:.78});
    expect(sources[0]?.content).toBe(records[0]!.content);expect(JSON.stringify(sources)).not.toContain('Texte RPC ignoré');
  });
  it('revient au lexical quand la génération ou la RPC échoue',async()=>{
    enable();mocks.limit.mockResolvedValueOnce(corpus()).mockResolvedValueOnce(indexed());mocks.embed.mockRejectedValueOnce(new Error('Panne simulée'));
    expect((await retrieveLawSources('Publicité'))[0]?.articleRef).toBe('A2');
    mocks.limit.mockResolvedValueOnce(corpus()).mockResolvedValueOnce(indexed());mocks.rpc.mockResolvedValueOnce({data:null,error:{message:'Panne'}});
    expect((await retrieveLawSources('Publicité'))[0]?.articleRef).toBe('A2');
  });
  it('refuse un corpus non fiable avant toute dépense',async()=>{
    enable();mocks.limit.mockResolvedValueOnce({data:[...records,{...records[0],article_ref:'BAD',source_url:'https://fraude.test'}],count:3,error:null});
    expect((await retrieveLawSources('Publicité')).map(source=>source.articleRef)).toEqual(['A2']);expect(mocks.embed).not.toHaveBeenCalled();
  });
  it('ne cite que des références uniques et officielles sans transmettre les extraits',()=>{
    const sources:LawSource[]=records.map(row=>({articleRef:row.article_ref,content:row.content,sourceUrl:row.source_url,effectiveOn:null,checkedAt:null}));
    const result=sourcesForCitations(['A2','A2','inconnue'],[...sources,{...sources[1]!,articleRef:'inconnue',sourceUrl:'https://fraude.test'}]);
    expect(result).toEqual([{articleRef:'A2',sourceUrl:records[1]!.source_url,effectiveOn:null,checkedAt:null}]);
    expect(JSON.stringify(result)).not.toContain('Publicité');
  });
});

it('interrompt la réponse si le coût embedding ne peut pas être enregistré',async()=>{
  enable();mocks.limit.mockResolvedValueOnce(corpus()).mockResolvedValueOnce(indexed());
  const failure=new Error('Journal indisponible');
  await expect(retrieveLawSources('Publicité',async()=>{throw failure;})).rejects.toBe(failure);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it('conserve la métrique embedding même si la recherche vectorielle doit se replier',async()=>{
  enable();mocks.limit.mockResolvedValueOnce(corpus()).mockResolvedValueOnce(indexed());
  mocks.rpc.mockResolvedValueOnce({data:null,error:{message:'Indisponible'}});
  const recorded:unknown[]=[];
  const sources=await retrieveLawSources('Publicité',async usage=>{recorded.push(usage);});
  expect(sources[0]?.articleRef).toBe('A2');expect(recorded).toHaveLength(1);
});
