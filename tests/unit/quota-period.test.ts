import { beforeEach,expect,it,vi } from 'vitest';
const mocks=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock('server-only',()=>({}));
vi.mock('../../lib/supabase/admin',()=>({createAdminSupabase:()=>({rpc:mocks.rpc})}));
import { consumeQuota,refundQuota } from '../../lib/security/quota';
beforeEach(()=>{vi.clearAllMocks();vi.useRealTimers();});
it('conserve la période retournée par PostgreSQL au lieu de la date du navigateur',async()=>{
 mocks.rpc.mockResolvedValueOnce({data:'2026-10-01',error:null});
 const period=await consumeQuota('actor','check');expect(period).toBe('2026-10-01');
 mocks.rpc.mockResolvedValueOnce({error:null});await refundQuota('actor','check',period);
 expect(mocks.rpc).toHaveBeenLastCalledWith('refund_usage_quota',{p_user_id:'actor',p_action:'check',p_period_start:'2026-10-01'});
});
it('refuse un quota épuisé ou une réponse sans période valide',async()=>{
 mocks.rpc.mockResolvedValueOnce({data:null,error:null});await expect(consumeQuota('actor','mia')).rejects.toMatchObject({status:429});
 mocks.rpc.mockResolvedValueOnce({data:true,error:null});await expect(consumeQuota('actor','mia')).rejects.toMatchObject({status:503});
});
