import { beforeEach, expect, it, vi } from 'vitest';
const m=vi.hoisted(()=>({load:vi.fn(),text:vi.fn(),vision:vi.fn(),audio:vi.fn(),rewrite:vi.fn(),log:vi.fn(),rpc:vi.fn()}));
vi.mock('server-only',()=>({}));
vi.mock('@/lib/media/prepared-analysis',()=>({loadPreparedAnalysis:m.load}));
vi.mock('@/lib/ai/text-analyzer',()=>({analyzeText:m.text}));
vi.mock('@/lib/ai/vision-analyzer',()=>({analyzeVisual:m.vision}));
vi.mock('@/lib/openai/audio',()=>({transcribePreparedAudio:m.audio}));
vi.mock('@/lib/ai/rewriter',()=>({rewriteCompliant:m.rewrite}));
vi.mock('@/lib/ai/usage',()=>({recordAiUsage:m.log}));
vi.mock('@/lib/social/preferences',()=>({readRewriteTone:async()=> 'naturel'}));
vi.mock('@/lib/supabase/admin',()=>({createAdminSupabase:()=>({rpc:m.rpc,storage:{from:()=>({download:vi.fn()})}})}));
import { analyzePreparedMedia } from '../../lib/ai/prepared-media-engine';
import { ModelOutputError } from '../../lib/openai/errors';
const usage={model:'gpt-4o',promptTokens:10,completionTokens:10,latencyMs:10,estimatedCostUsd:0.000125};
const input={userId:'owner',jobId:'job',verificationId:'verification',caption:'Publicité — Exemple',platform:'instagram' as const,kind:'video' as const,result:{},includeAudio:false};
const visual={hasBrandLogo:false,brandNames:[],hasPromoCode:false,hasPeople:false,confidence:0.8,rawAnalysis:'Fond uni',usage};
beforeEach(()=>{
 vi.clearAllMocks();
 m.load.mockResolvedValue({images:[{name:'frame-01.jpg',dataUrl:'data:one'},{name:'frame-02.jpg',dataUrl:'data:two'},{name:'frame-03.jpg',dataUrl:'data:three'}],evidence:[{name:'manifest.json',sha256:'a'.repeat(64),bytes:100}],warnings:['Trois images ne garantissent pas une mention continue.']});
 m.text.mockResolvedValue({ruleViolations:[],aiFlags:[],usage});m.vision.mockResolvedValue(visual);
 m.log.mockResolvedValue(undefined);m.rpc.mockResolvedValue({data:'2026-11-01',error:null});
});
it('ne transmet rien à OpenAI avant validation complète des fichiers privés',async()=>{
 m.load.mockRejectedValue(new Error('Empreinte corrompue'));
 await expect(analyzePreparedMedia(input)).rejects.toThrow('Empreinte');
 expect(m.text).not.toHaveBeenCalled();expect(m.vision).not.toHaveBeenCalled();expect(m.audio).not.toHaveBeenCalled();
});
it('analyse les trois frames, journalise chaque appel et décrit la couverture réelle',async()=>{
 const result=await analyzePreparedMedia(input);
 expect(m.vision).toHaveBeenCalledTimes(3);expect(m.log).toHaveBeenCalledTimes(4);
 expect(result.analysisMode).toBe('full');expect(result.coverage).toMatchObject({imagesAnalyzed:3,imagesExpected:3,audio:'not_requested'});
 expect(result.hashSha256).toMatch(/^[a-f0-9]{64}$/);expect(result.warnings.join(' ')).toContain('continue');
 expect(m.audio).not.toHaveBeenCalled();
});
it('reste partiel si une frame échoue et conserve les coûts d’une réponse IA invalide',async()=>{
 m.vision.mockRejectedValueOnce(new ModelOutputError('schema_mismatch',usage));
 const result=await analyzePreparedMedia(input);
 expect(result.analysisMode).toBe('partial');expect(result.coverage.imagesAnalyzed).toBe(2);
 expect(m.log).toHaveBeenCalledWith('verification','vision',usage,expect.objectContaining({status:'invalid_output'}));
});
it('réserve la réécriture seulement pour un risque suffisant et rembourse son échec sur la période réservée',async()=>{
 m.rewrite.mockRejectedValue(new Error('Fournisseur indisponible'));
 const result=await analyzePreparedMedia({...input,caption:'Mon code promo X, merci @marque #collab'});
 expect(m.rpc).toHaveBeenCalledWith('reserve_usage_quota',{p_user_id:'owner',p_action:'rewrite'});
 expect(m.rpc).toHaveBeenCalledWith('refund_usage_quota',{p_user_id:'owner',p_action:'rewrite',p_period_start:'2026-11-01'});
 expect(result.rewrite).toBeNull();expect(result.analysisMode).toBe('partial');
});
it('transmet la transcription comme contexte sans remplacer la légende ni ses règles',async()=>{
 m.load.mockResolvedValue({images:[{name:'frame-01.jpg',dataUrl:'data:one'}],audio:{bytes:new Uint8Array(64),durationSeconds:2},evidence:[],warnings:[]});
 m.audio.mockResolvedValue({text:'Collaboration commerciale',usage:{...usage,model:'gpt-transcribe'},durationSeconds:2});
 m.rewrite.mockResolvedValue({rewrittenCaption:'Publicité — Test',changes:[],confidence:0.8,usage});
 const result=await analyzePreparedMedia({...input,caption:'Mon code promo X, merci @marque',includeAudio:true});
 expect(m.text).toHaveBeenCalledWith('Mon code promo X, merci @marque','instagram',expect.objectContaining({transcript:'Collaboration commerciale'}));
 expect(result.violations.some(v=>v.code==='R1')).toBe(true);expect(result.coverage.audio).toBe('transcribed');
 expect(m.log).toHaveBeenCalledWith('verification','transcription',expect.objectContaining({model:'gpt-transcribe'}),expect.objectContaining({durationSeconds:2}));
});
it('les règles seules ne sont déclarées que lorsque aucun appel IA n’a réussi',async()=>{
 m.text.mockRejectedValue(new Error('Service indisponible'));m.vision.mockRejectedValue(new Error('Service indisponible'));
 const result=await analyzePreparedMedia(input);expect(result.analysisMode).toBe('rules_only');expect(m.log).not.toHaveBeenCalled();
 m.vision.mockResolvedValue(visual);
 expect((await analyzePreparedMedia(input)).analysisMode).toBe('partial');
});
it('échoue si le journal de coûts ne peut pas être enregistré',async()=>{
 m.log.mockRejectedValue(new Error('Journal indisponible'));
 await expect(analyzePreparedMedia(input)).rejects.toThrow('Journal');
 expect(m.text).not.toHaveBeenCalled();
});
it('indique explicitement une transcription vide sans prétendre avoir compris des paroles',async()=>{
 m.load.mockResolvedValue({images:[{name:'frame-01.jpg',dataUrl:'data:one'}],audio:{bytes:new Uint8Array(64),durationSeconds:2},evidence:[],warnings:[]});
 m.audio.mockResolvedValue({text:'',usage:{...usage,model:'gpt-transcribe'},durationSeconds:2});
 const result=await analyzePreparedMedia({...input,includeAudio:true});
 expect(result.coverage.audio).toBe('transcribed');expect(result.warnings.join(' ')).toContain('Aucune parole exploitable');
});
it('signale une transcription tronquée sans prétendre avoir contrôlé les paroles restantes',async()=>{
 m.load.mockResolvedValue({images:[{name:'frame-01.jpg',dataUrl:'data:one'}],audio:{bytes:new Uint8Array(64),durationSeconds:2},evidence:[],warnings:[]});
 m.audio.mockResolvedValue({text:'x'.repeat(12_000),truncated:true,usage:{...usage,model:'gpt-transcribe'},durationSeconds:2});
 const result=await analyzePreparedMedia({...input,includeAudio:true});
 expect(result.coverage.audio).toBe('transcribed');
 expect(result.warnings.join(' ')).toContain('La transcription est tronquée');
});
it('reste partiel lorsque la transcription demandée échoue',async()=>{
 m.load.mockResolvedValue({images:[{name:'frame-01.jpg',dataUrl:'data:one'}],audio:{bytes:new Uint8Array(64),durationSeconds:2},evidence:[],warnings:[]});
 m.audio.mockRejectedValue(new Error('provider secret'));
 const result=await analyzePreparedMedia({...input,includeAudio:true});
 expect(result.analysisMode).toBe('partial');expect(result.coverage.audio).toBe('unavailable');expect(JSON.stringify(result)).not.toContain('provider secret');
});
