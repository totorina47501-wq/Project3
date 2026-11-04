import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({admin:vi.fn(),rewrite:vi.fn(),text:vi.fn(),rpc:vi.fn(),preference:vi.fn(),eq:vi.fn()}));
vi.mock('server-only',()=>({}));
vi.mock('@/lib/supabase/admin',()=>({createAdminSupabase:mocks.admin}));
vi.mock('@/lib/ai/text-analyzer',()=>({analyzeText:mocks.text}));
vi.mock('@/lib/ai/vision-analyzer',()=>({analyzeVisual:vi.fn()}));
vi.mock('@/lib/ai/rewriter',()=>({rewriteCompliant:mocks.rewrite}));
vi.mock('@/lib/ai/failure',()=>({reportAiFailure:vi.fn()}));
import { runCheck } from '../../lib/ai/mentioncheck-engine';
import { readRewriteTone } from '../../lib/social/preferences';
const telemetry={model:'fixture',promptTokens:0,completionTokens:0,latencyMs:1,estimatedCostUsd:0};
beforeEach(()=>{
  vi.clearAllMocks();mocks.rpc.mockResolvedValue({data:true,error:null});
  mocks.preference.mockResolvedValue({data:{rewrite_tone:'créatif'},error:null});
  mocks.text.mockResolvedValue({aiFlags:[],ruleViolations:[],usage:telemetry});
  mocks.rewrite.mockResolvedValue({rewrittenCaption:'Publicité — Offre',changes:[],confidence:1,usage:telemetry});
  mocks.admin.mockReturnValue({rpc:mocks.rpc,from:(table:string)=>{
    if(table==='user_preferences')return {select:()=>({eq:mocks.eq.mockImplementation(()=>({maybeSingle:mocks.preference}))})};
    if(table==='ai_analyses')return {insert:()=>Promise.resolve({error:null})};
    const updateQuery={eq:vi.fn().mockReturnThis(),then:(resolve:(value:unknown)=>void)=>resolve({error:null})};
    return {insert:()=>({select:()=>({single:()=>Promise.resolve({data:{id:'fixture'},error:null})})}),update:()=>updateQuery};
  }});
});
describe('Préférence de ton dans le moteur existant',()=>{
  it('transmet le ton personnel uniquement à la réécriture déjà prévue',async()=>{
    await runCheck({caption:'Mon code promo X économise 30 %, merci @marque !',platform:'instagram',userId:'owner'});
    expect(mocks.rewrite).toHaveBeenCalledOnce();
    expect(mocks.rewrite.mock.calls[0]?.[2]).toBe('créatif');
    expect(mocks.eq).toHaveBeenCalledWith('user_id','owner');
    expect(mocks.text).toHaveBeenCalledOnce();
  });
  it('reste naturel avec une ancienne base ou une préférence invalide',async()=>{
    const client=mocks.admin();
    for(const result of [{data:null,error:{code:'42P01'}},{data:{rewrite_tone:'bad'},error:null},{data:null,error:null}]){
      mocks.preference.mockResolvedValueOnce(result);
      expect(await readRewriteTone(client,'owner')).toBe('naturel');
    }
  });
  it('ne lance aucune réécriture ou lecture supplémentaire si le score est bon',async()=>{
    await runCheck({caption:'Publicité : partenariat rémunéré avec Marque. #publicité',platform:'instagram',userId:'owner'});
    expect(mocks.rewrite).not.toHaveBeenCalled();expect(mocks.preference).not.toHaveBeenCalled();
  });
});
