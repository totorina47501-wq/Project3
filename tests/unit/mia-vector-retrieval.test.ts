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
  mocks.create.mockImplementation(()=>({from:()=>({select:()=>{const query={order:()=>query,not:()=>query,eq:()=>query,limit:mocks.limit};return query;}}),rpc:mocks.rpc}));
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

it('lit les pages supplémentaires au-delà de 30 documents sans appeler OpenAI',async()=>{
  const many=Array.from({length:35},(_,i)=>({
    article_ref:'DOC-'+String(i).padStart(3,'0'),
    content:i===34?'Concours et tirage au sort publicitaire':'Transparence commerciale',
    source_url:'https://www.legifrance.gouv.fr/loda/id/TEST',
    effective_on:null,checked_at:null,
  }));
  const range=vi.fn().mockResolvedValue({data:many.slice(30),error:null,count:35});
  mocks.create.mockImplementation(()=>({from:()=>({select:()=>({
    order:()=>({limit:vi.fn().mockResolvedValue({data:many.slice(0,30),error:null,count:35}),range}),
  })}),rpc:mocks.rpc}));
  const found=await retrieveLawSources('Concours et tirage au sort');
  expect(found[0]?.articleRef).toBe('DOC-034');
  expect(range).toHaveBeenCalledWith(30,59);
  expect(mocks.embed).not.toHaveBeenCalled();
});

it('échoue explicitement quand le corpus change pendant la pagination',async()=>{
  const many=Array.from({length:30},(_,i)=>({
    article_ref:'DOC-'+i,content:'Publicité',source_url:'https://www.legifrance.gouv.fr/loda/id/TEST',
  }));
  mocks.create.mockImplementation(()=>({from:()=>({select:()=>({
    order:()=>({limit:vi.fn().mockResolvedValue({data:many,error:null,count:35}),
      range:vi.fn().mockResolvedValue({data:many.slice(0,5),error:null,count:36})}),
  })}),rpc:mocks.rpc}));
  await expect(retrieveLawSources('Publicité')).rejects.toThrow('Corpus modifié');
});
it('utilise aussi le vecteur au-delà de trente sources si toute la couverture est validée',async()=>{
 enable();const many=Array.from({length:35},(_,i)=>({...records[0],article_ref:'D'+i}));
 const indexes=many.map(row=>({article_ref:row.article_ref,embedding_model:'text-embedding-3-small'}));
 mocks.create.mockImplementation(()=>({from:()=>({select:(fields:string)=>{
  const rows=fields.includes('content')?many:indexes;
  const query={not:()=>query,eq:()=>query,order:()=>query,limit:async(n:number)=>({data:rows.slice(0,n),count:35,error:null}),range:async(a:number,b:number)=>({data:rows.slice(a,b+1),count:35,error:null})};return query;
 }}),rpc:mocks.rpc}));
 mocks.rpc.mockResolvedValue({data:[{article_ref:'D34',source_url:many[34]!.source_url,similarity:.99}],error:null});
 expect((await retrieveLawSources('Inconnue'))[0]?.articleRef).toBe('D34');expect(mocks.embed).toHaveBeenCalledOnce();
});
