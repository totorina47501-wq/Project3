import { beforeEach,expect,it,vi } from 'vitest';
const mocks=vi.hoisted(()=>({user:vi.fn(),answer:vi.fn(),quota:vi.fn(),refund:vi.fn(),rows:[] as Record<string,unknown>[]}));
vi.mock('server-only',()=>({}));
vi.mock('../../lib/security/auth',async original=>({...await original<typeof import('../../lib/security/auth')>(),requireUser:mocks.user}));
vi.mock('../../lib/mia/assistant',()=>({answerMia:mocks.answer}));
vi.mock('../../lib/security/quota',()=>({consumeQuota:mocks.quota,refundQuota:mocks.refund}));
vi.mock('../../lib/security/rate-limit',()=>({checkRateLimit:vi.fn()}));
vi.mock('../../lib/supabase/admin',()=>({createAdminSupabase:()=>({from:(table:string)=>{
  const query={select:()=>query,eq:()=>query,single:async()=>({data:table==='users'?{plan:'solo'}:{id:'20000000-0000-4000-8000-000000000001'},error:null}),
    insert:(row:Record<string,unknown>|Record<string,unknown>[])=>{
      if(table==='ai_analyses'){mocks.rows.push(...(Array.isArray(row)?row:[row]));return Promise.resolve({error:null});}
      return query;
    }};return query;
}})}));
import { POST } from '../../app/api/mia/chat/route';
import { ModelOutputError } from '../../lib/openai/errors';
const owner='10000000-0000-4000-8000-000000000001';
const usage={model:'gpt-4o',promptTokens:100,completionTokens:30,estimatedCostUsd:.00055,latencyMs:10};
const request=()=>new Request('https://mentioncheck.test/api/mia/chat',{method:'POST',headers:{origin:'https://mentioncheck.test','content-type':'application/json'},body:JSON.stringify({question:'Quelle mention publicitaire utiliser ?'})});
beforeEach(()=>{vi.clearAllMocks();mocks.rows.length=0;mocks.user.mockResolvedValue({user:{id:owner}});mocks.quota.mockResolvedValue('2026-11-01');});
it('rattache embedding et réponse Mia au compte sans créer de fausse vérification',async()=>{
  mocks.answer.mockImplementation(async(_q,_h,_c,logEmbedding)=>{
    await logEmbedding({...usage,model:'text-embedding-3-small',completionTokens:0,estimatedCostUsd:.000002});
    return {answer:'Réponse fictive',sources:[],usage,auxiliaryUsage:[]};
  });
  expect((await POST(request())).status).toBe(200);
  expect(mocks.rows.map(row=>row.stage)).toEqual(['embedding','assistant']);
  expect(mocks.rows.every(row=>row.user_id===owner&&row.verification_id===null)).toBe(true);
  expect(JSON.stringify(mocks.rows)).not.toContain('Quelle mention');
});
it('trace une réponse invalide consommée et rembourse le quota applicatif',async()=>{
  mocks.answer.mockRejectedValue(new ModelOutputError('schema_mismatch',usage));
  expect((await POST(request())).status).toBe(503);
  expect(mocks.rows[0]).toMatchObject({user_id:owner,stage:'assistant',cost_usd:.00055,raw_response:{status:'invalid_output',kind:'schema_mismatch'}});
  expect(mocks.refund).toHaveBeenCalledWith(owner,'mia','2026-11-01');
});
