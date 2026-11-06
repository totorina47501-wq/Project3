import 'server-only';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { loadPreparedAnalysis } from '@/lib/media/prepared-analysis';
import { analyzeVisual } from '@/lib/ai/vision-analyzer';
import { analyzeText } from '@/lib/ai/text-analyzer';
import { transcribePreparedAudio } from '@/lib/openai/audio';
import { rewriteCompliant } from '@/lib/ai/rewriter';
import { recordAiUsage } from '@/lib/ai/usage';
import { ModelOutputError } from '@/lib/openai/errors';
import { reportAiFailure } from '@/lib/ai/failure';
import { readRewriteTone } from '@/lib/social/preferences';
import { applyRules,riskFrom,levelFromRisk } from '@/lib/ai/rules';
import type { AiFlag,AnalysisResult,ModelTelemetry,Platform } from '@/lib/ai/schemas';

type Input={userId:string;jobId:string;verificationId:string;caption:string;platform:Platform;
 kind:'video'|'carousel';result:unknown;includeAudio:boolean};
type UsageResult={usage:ModelTelemetry};
export type PreparedMediaResult=AnalysisResult & {coverage:{imagesExpected:number;imagesAnalyzed:number;
 audio:'not_requested'|'absent'|'transcribed'|'unavailable';textAnalyzed:boolean}};

export async function analyzePreparedMedia(input:Input):Promise<PreparedMediaResult> {
 const admin=createAdminSupabase();
 // Toutes les lectures, empreintes et limites sont validées avant le premier coût IA.
 const prepared=await loadPreparedAnalysis(input,async(path)=>{
  const {data,error}=await admin.storage.from('verification-media-derived').download(path);
  if(error||!data) throw new Error('Média privé indisponible.');
  return new Uint8Array(await data.arrayBuffer());
 });
 const warnings=[...prepared.warnings];
 const coverage:PreparedMediaResult['coverage']={imagesExpected:prepared.images.length,imagesAnalyzed:0,
  audio:input.includeAudio?'absent':'not_requested',textAnalyzed:false};
 let successfulCalls=0;
 let incomplete=false;
 const stage=async<T extends UsageResult>(name:string,work:()=>Promise<T>,metrics:(value:T)=>unknown):Promise<T|null>=>{
  let value:T;
  try {value=await work();}
  catch(error){
   // Un JSON rejeté a pu être facturé : conserver les tokens connus avant repli.
   if(error instanceof ModelOutputError) await recordAiUsage(input.verificationId,name,error.usage,
    {status:'invalid_output',kind:error.kind});
   reportAiFailure(name as 'text'|'vision'|'rewrite'|'transcription',error);
   incomplete=true;
   warnings.push(name==='vision'?"Une image n’a pas pu être analysée par l’IA.":
    name==='transcription'?"La transcription audio est indisponible ; les paroles n’ont pas été contrôlées.":
    name==='rewrite'?"La réécriture IA n’a pas pu être générée.":"L’analyse contextuelle de la légende est indisponible.");
   return null;
  }
  // Une panne du journal arrête le traitement : ne pas masquer un coût non enregistré.
  await recordAiUsage(input.verificationId,name,value.usage,metrics(value));
  successfulCalls++;
  return value;
 };
 let transcript:string|undefined;
 if(input.includeAudio&&prepared.audio){
  const audioInput=prepared.audio;
  const audio=await stage('transcription',()=>transcribePreparedAudio(audioInput),value=>({
   durationSeconds:value.durationSeconds,characters:value.text.length,tokenCountsReported:value.tokenCountsReported,
  }));
  coverage.audio=audio?'transcribed':'unavailable';
  if(audio) transcript=audio.text;
 }
 const observations:Array<{name:string;analysis:string}>=[];
 const aiFlags:AiFlag[]=[];
 // Au plus cinq images compressées ; pas de nouvelle extraction ni téléchargement URL.
 for(const image of prepared.images){
  const visual=await stage('vision',()=>analyzeVisual(image.dataUrl,'image'),value=>({
   artifact:image.name,hasBrandLogo:value.hasBrandLogo,hasPromoCode:value.hasPromoCode,
  }));
  if(!visual) continue;
  coverage.imagesAnalyzed++;
  observations.push({name:image.name,analysis:visual.rawAnalysis});
  if(visual.hasBrandLogo||visual.hasPromoCode){
   aiFlags.push({title:visual.hasPromoCode?'Code promotionnel visible':'Marque visible',
    explanation:`${image.name} : ${visual.hasPromoCode?'un code promotionnel':'une marque'} a été observé. Vérifie la transparence si une contrepartie commerciale existe.`,
    confidence:visual.confidence});
  }
 }
 const text=await stage('text',()=>analyzeText(input.caption,input.platform,{
  observations,...(transcript===undefined?{}:{transcript}),
 }),value=>({flags:value.aiFlags.length,violations:value.ruleViolations.length}));
 coverage.textAnalyzed=Boolean(text);
 if(text) aiFlags.push(...text.aiFlags);
 // Les paroles et les mentions des images ne satisfont jamais silencieusement
 // les règles de la légende. Une marque seule ne prouve aucune contrepartie.
 const violations=applyRules(input.caption,input.platform);
 const risk=riskFrom(violations,aiFlags.length?Math.max(...aiFlags.map(flag=>flag.confidence)):0);
 const score=100-risk;
 let rewrite:AnalysisResult['rewrite']=null;
 if(score<60&&text){
  const {data:period,error}=await admin.rpc('reserve_usage_quota',{p_user_id:input.userId,p_action:'rewrite'});
  if(error) throw new Error('Quota de réécriture indisponible.');
  if(period){
   if(typeof period!=='string'||!/^\d{4}-\d{2}-01$/.test(period)) throw new Error('Période de quota invalide.');
   let suggested:Awaited<ReturnType<typeof rewriteCompliant>>|null=null;
   try {
    const tone=await readRewriteTone(admin,input.userId);
    suggested=await stage('rewrite',()=>rewriteCompliant(input.caption,violations,tone),value=>({changes:value.changes.length}));
   } finally {
    if(!suggested){
     const refund=await admin.rpc('refund_usage_quota',{p_user_id:input.userId,p_action:'rewrite',p_period_start:period});
     if(refund.error) console.error('[mentioncheck][quota_refund_failed]',{action:'rewrite'});
    }
   }
   if(suggested) rewrite={rewrittenCaption:suggested.rewrittenCaption,changes:suggested.changes,confidence:suggested.confidence};
  } else warnings.push('Le quota de réécritures est atteint. Le contrôle reste disponible.');
 }
 const canonical=JSON.stringify({version:'prepared-media-v1',job:input.jobId,caption:input.caption,
  platform:input.platform,evidence:prepared.evidence,coverage});
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical));
 const hashSha256=Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
 return {score,riskLevel:levelFromRisk(risk),violations,aiFlags,rewrite,hashSha256,
  verificationId:input.verificationId,analysisMode:successfulCalls===0?'rules_only':incomplete?'partial':'full',
  warnings:[...new Set(warnings)],coverage};
}
