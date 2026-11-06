// Routes réellement exécutées ; aucun client Supabase ou OpenAI réel.
import { beforeEach,afterEach,describe,expect,it,vi } from 'vitest';
const mocks=vi.hoisted(()=>({create:vi.fn(),read:vi.fn(),generate:vi.fn(),write:vi.fn()}));
vi.mock('../../lib/supabase/admin',()=>({createAdminSupabase:mocks.create}));
vi.mock('../../lib/openai/embeddings',()=>({generateLegalEmbedding:mocks.generate}));
vi.mock('../../lib/mia/index-corpus',()=>({readLawIndexPlan:mocks.read}));
import { POST } from '../../app/api/internal/mia-index/route';
const token='offline-token-'.repeat(4);
const rows=Array.from({length:35},(_,i)=>({id:String(i),article_ref:'TEST-'+i,content:'Texte fictif local',source_url:'https://www.legifrance.gouv.fr/loda/id/TEST'}));
const request=(execute=false,auth=token)=>new Request('https://local.test/api/internal/mia-index'+(execute?'?execute=true':''),{method:'POST',headers:{authorization:'Bearer '+auth}});
beforeEach(()=>{
 vi.clearAllMocks();vi.stubEnv('MIA_INDEX_TOKEN',token);vi.stubEnv('OPENAI_EMBEDDINGS_ENABLED','true');
 vi.stubEnv('OPENAI_PAUSED','false');vi.stubEnv('OPENAI_API_KEY','offline-not-a-real-key');
 mocks.read.mockResolvedValue({total:35,indexed:0,pending:rows,batch:rows.slice(0,5)});
 mocks.generate.mockResolvedValue({model:'text-embedding-3-small',vector:[1]});
 mocks.write.mockResolvedValue({data:[{id:'0'}],error:null});
 const query={eq:()=>query,select:mocks.write};
 mocks.create.mockReturnValue({from:()=>({update:()=>query})});
});
afterEach(()=>vi.unstubAllEnvs());
describe('lots index légaux Worker bornés',()=>{
 it('refuse un jeton invalide avant de lire le corpus',async()=>{
  expect((await POST(request(false,'wrong'))).status).toBe(401);expect(mocks.read).not.toHaveBeenCalled();
 });
 it('aperçoit 35 sources sans embeddings ni écriture',async()=>{
  const response=await POST(request());expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({dryRun:true,total:35,pending:35,batchSize:5,maxBatch:5});
  expect(mocks.generate).not.toHaveBeenCalled();expect(mocks.write).not.toHaveBeenCalled();
 });
 it('indexe cinq sources puis indique les trente restantes',async()=>{
  mocks.read.mockResolvedValueOnce({total:35,indexed:0,pending:rows,batch:rows.slice(0,5)})
   .mockResolvedValueOnce({total:35,indexed:5,pending:rows.slice(5),batch:rows.slice(5,10)});
  const response=await POST(request(true));expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({indexed:5,total:35,remaining:30,verified:false});
  expect(mocks.generate).toHaveBeenCalledTimes(5);expect(mocks.write).toHaveBeenCalledTimes(5);
 });
 it('ne dépense rien lorsque les embeddings sont désactivés',async()=>{
  vi.stubEnv('OPENAI_EMBEDDINGS_ENABLED','false');
  expect((await POST(request(true))).status).toBe(503);expect(mocks.generate).not.toHaveBeenCalled();
 });
 it('signale un conflit de contenu sans poursuivre le lot',async()=>{
  mocks.write.mockResolvedValue({data:[],error:null});vi.spyOn(console,'warn').mockImplementation(()=>{});
  expect((await POST(request(true))).status).toBe(503);expect(mocks.generate).toHaveBeenCalledOnce();vi.restoreAllMocks();
 });
});
