import {beforeEach,afterEach,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({auth:vi.fn(),rpc:vi.fn(),engine:vi.fn(),rate:vi.fn(),from:vi.fn()}));
vi.mock('server-only',()=>({}));
vi.mock('@/lib/security/auth',async original=>({...await original<typeof import('../../lib/security/auth')>(),requireUser:m.auth}));
vi.mock('@/lib/supabase/admin',()=>({createAdminSupabase:()=>({from:m.from,rpc:m.rpc})}));
vi.mock('@/lib/ai/prepared-media-engine',()=>({analyzePreparedMedia:m.engine}));
vi.mock('@/lib/security/rate-limit',()=>({checkRateLimit:m.rate}));
import {POST} from '../../app/api/media/jobs/[id]/analyze/route';
const owner='95000000-0000-4000-8000-000000000001',job='95100000-0000-4000-8000-000000000001';
const verification='95200000-0000-4000-8000-000000000001',run='95300000-0000-4000-8000-000000000001';
const context={params:Promise.resolve({id:job})};
const request=(body:unknown,origin='https://mentioncheck.test')=>new Request(`https://mentioncheck.test/api/media/jobs/${job}/analyze`,{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)});
beforeEach(()=>{
 vi.clearAllMocks();vi.stubEnv('MEDIA_AI_ENABLED','true');vi.stubEnv('OPENAI_PAUSED','false');vi.stubEnv('OPENAI_API_KEY','fixture-not-a-secret');vi.stubEnv('OPENAI_TEXT_ENABLED','true');vi.stubEnv('OPENAI_VISION_ENABLED','true');vi.stubEnv('OPENAI_AUDIO_ENABLED','false');
 const chain={select:()=>chain,eq:()=>chain,single:async()=>({data:{plan:'solo',kind:'video',status:'completed',result:{},verification_id:'source',platform:'instagram',content_text:'Publicité — Test'},error:null})};
 m.from.mockReturnValue(chain);m.auth.mockResolvedValue({user:{id:owner},client:{from:m.from}});
 m.rpc.mockResolvedValue({data:{id:run,verification_id:verification,claimed:true,status:'processing'},error:null});
 m.engine.mockResolvedValue({verificationId:verification,analysisMode:'full'});
});
afterEach(()=>vi.unstubAllEnvs());
it('exige une origine correcte avant toute réservation',async()=>{
 expect((await POST(request({includeAudio:false},'https://tiers.test'),context)).status).toBe(403);expect(m.rpc).not.toHaveBeenCalled();
});
it('refuse paramètres injectés, corps excessif et identifiant incorrect',async()=>{
 expect((await POST(request({includeAudio:false,userId:owner}),context)).status).toBe(400);
 expect((await POST(request({includeAudio:false,x:'a'.repeat(1024)}),context)).status).toBe(413);
 expect((await POST(request({includeAudio:false}),{params:Promise.resolve({id:'../other'})})).status).toBe(400);
 expect(m.engine).not.toHaveBeenCalled();
});
it('ne consomme aucun quota si les appels IA ou audio sont désactivés',async()=>{
 vi.stubEnv('OPENAI_PAUSED','true');expect((await POST(request({includeAudio:false}),context)).status).toBe(503);
 vi.stubEnv('OPENAI_PAUSED','false');expect((await POST(request({includeAudio:true}),context)).status).toBe(503);expect(m.rpc).not.toHaveBeenCalled();
});
it('refuse la réservation lorsque le quota média est épuisé',async()=>{
 m.rpc.mockResolvedValue({data:null,error:{code:'54000'}});
 const response=await POST(request({includeAudio:false}),context);
 expect(response.status).toBe(429);expect(m.engine).not.toHaveBeenCalled();
 expect(m.rpc).toHaveBeenCalledWith('media_ai_claim',{p_user:owner,p_job:job,p_audio:false});
});
it('n’appelle pas le moteur pour une analyse déjà enregistrée',async()=>{
 m.rpc.mockResolvedValue({data:{id:run,verification_id:verification,claimed:false,status:'completed',result:{score:95}},error:null});
 const response=await POST(request({includeAudio:false}),context);
 expect(response.status).toBe(200);expect((await response.json()).result.score).toBe(95);expect(m.engine).not.toHaveBeenCalled();
});
it('retourne le résultat audio déjà terminé sans second appel IA',async()=>{
 vi.stubEnv('OPENAI_AUDIO_ENABLED','true');
 m.rpc.mockResolvedValue({data:{id:run,verification_id:verification,claimed:false,status:'completed',result:{coverage:{audio:'transcribed'}}},error:null});
 const response=await POST(request({includeAudio:true}),context);
 expect(response.status).toBe(200);expect((await response.json()).result.coverage.audio).toBe('transcribed');
 expect(m.rpc).toHaveBeenCalledWith('media_ai_claim',{p_user:owner,p_job:job,p_audio:true});
 expect(m.engine).not.toHaveBeenCalled();
});
it('répond 202 au double clic en cours sans second appel IA',async()=>{
 m.rpc.mockResolvedValue({data:{id:run,verification_id:verification,claimed:false,status:'processing'},error:null});
 expect((await POST(request({includeAudio:false}),context)).status).toBe(202);expect(m.engine).not.toHaveBeenCalled();
});
it('finalise atomiquement le résultat propriétaire et masque les erreurs fournisseur',async()=>{
 m.rpc.mockResolvedValueOnce({data:{id:run,verification_id:verification,claimed:true,status:'processing'},error:null}).mockResolvedValue({data:true,error:null});
 expect((await POST(request({includeAudio:false}),context)).status).toBe(200);
 expect(m.rpc).toHaveBeenLastCalledWith('media_ai_finish',{p_user:owner,p_run:run,p_result:{verificationId:verification,analysisMode:'full'},p_expired:false});
 m.rpc.mockResolvedValueOnce({data:{id:run,verification_id:verification,claimed:true,status:'processing'},error:null}).mockResolvedValue({data:true,error:null});
 m.engine.mockRejectedValue(new Error('secret-provider-key'));
 const response=await POST(request({includeAudio:false}),context);expect(response.status).toBe(503);expect(await response.text()).not.toContain('secret');
 expect(m.rpc).toHaveBeenLastCalledWith('media_ai_finish',{p_user:owner,p_run:run,p_result:null,p_expired:false});
});
