import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const calls=vi.hoisted(()=>({limit:vi.fn()}));
vi.mock('../../lib/security/rate-limit',()=>({checkRateLimit:calls.limit}));
import { requireAuthAttemptLimit } from '../../lib/security/auth-attempt-limit';
beforeEach(()=>{calls.limit.mockReset();vi.stubEnv('NODE_ENV','production');calls.limit.mockResolvedValue(undefined);});
afterEach(()=>vi.unstubAllEnvs());
const req=(ip?:string)=>new Request('https://mentioncheck.test/api/auth/login',{headers:ip?{'cf-connecting-ip':ip}:{}});
it('refuse fermé sans véritable adresse Cloudflare',async()=>{
 await expect(requireAuthAttemptLimit(req())).rejects.toMatchObject({status:503});
 await expect(requireAuthAttemptLimit(req('spoofed,1.2.3.4'))).rejects.toMatchObject({status:503});
 expect(calls.limit).not.toHaveBeenCalled();
});
it('partage la limite IP entre inscription et connexion sans enregistrer son adresse',async()=>{
 await requireAuthAttemptLimit(req('203.0.113.5'));
 await requireAuthAttemptLimit(req('203.0.113.5'));
 expect(calls.limit).toHaveBeenCalledTimes(2);
 const [key,plan]=calls.limit.mock.calls[0];
 expect(key).toMatch(/^auth:[a-f0-9]{64}$/);
 expect(key).not.toContain('203.0.113.5');
 expect(plan).toBe('solo');
 expect(calls.limit.mock.calls[1][0]).toBe(key);
});
it('ne dépend pas du rate limiter de production hors Worker',async()=>{
 vi.stubEnv('NODE_ENV','test');
 await requireAuthAttemptLimit(req());
 expect(calls.limit).not.toHaveBeenCalled();
});
