import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({auth:vi.fn(),admin:vi.fn(),quota:vi.fn(),runCheck:vi.fn(),
 rules:vi.fn(),media:vi.fn(),rate:vi.fn()}));
vi.mock('server-only',()=>({}));
vi.mock('../../lib/security/origin',()=>({isSameOrigin:()=>true}));
vi.mock('../../lib/security/auth',async original=>({
 ...await original<typeof import('../../lib/security/auth')>(),requireUser:mocks.auth
}));
vi.mock('../../lib/supabase/admin',()=>({createAdminSupabase:mocks.admin}));
vi.mock('../../lib/security/quota',()=>({consumeQuota:mocks.quota,refundQuota:vi.fn()}));
vi.mock('../../lib/security/rate-limit',()=>({checkRateLimit:mocks.rate}));
vi.mock('../../lib/ai/mentioncheck-engine',()=>({runCheck:mocks.runCheck,validateMedia:mocks.media}));
vi.mock('../../lib/ai/rules-only-engine',()=>({runRulesOnlyCheck:mocks.rules}));
import {POST} from '../../app/api/check/route';
const request=(execution:'ai'|'rules_only',mediaType:'none'|'image'='none')=>new Request('https://local.test/api/check',{
 method:'POST',headers:{'content-type':'application/json',origin:'https://local.test'},
 body:JSON.stringify({caption:'Publication avec #partenariat',platform:'instagram',
   execution,mediaType,...(mediaType==='image'?{mediaUrl:'private/example.webp'}:{})})
});
beforeEach(()=>{
 vi.clearAllMocks();
 mocks.auth.mockResolvedValue({user:{id:'10000000-0000-4000-8000-000000000001'}});
 vi.stubEnv('OPENAI_PAUSED','true');
 vi.stubEnv('OPENAI_TEXT_ENABLED','false');
 vi.stubEnv('OPENAI_VISION_ENABLED','false');
});
afterEach(()=>vi.unstubAllEnvs());
it('refuse le mode IA en pause avant quota, SDK, stockage et profil',async()=>{
 const response=await POST(request('ai'));
 expect(response.status).toBe(503);
 expect((await response.json()).error).toContain('contrôle sans IA');
 for(const mock of [mocks.admin,mocks.quota,mocks.runCheck,mocks.media,mocks.rate])
   expect(mock).not.toHaveBeenCalled();
});
it('refuse le mode image IA en pause avant upload de nouveau média',async()=>{
 const response=await POST(request('ai','image'));
 expect(response.status).toBe(503);
 expect(mocks.media).not.toHaveBeenCalled();
 expect(mocks.quota).not.toHaveBeenCalled();
});
it('le mode sans IA reste autorisé jusqu’au contrôle du profil, sans réserver de quota',async()=>{
 mocks.admin.mockReturnValue({from:()=>({select:()=>({eq:()=>({single:async()=>({
   data:{plan:'solo'},error:null
 })})})})});
 mocks.rules.mockResolvedValue({analysisMode:'rules_only'});
 const response=await POST(request('rules_only'));
 expect(response.status).toBe(200);
 expect(mocks.quota).not.toHaveBeenCalled();
 expect(mocks.runCheck).not.toHaveBeenCalled();
 await response.body?.cancel();
});
