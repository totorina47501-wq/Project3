import {z} from 'zod';
import {requireUser,HttpError,publicError} from '@/lib/security/auth';
import {isSameOrigin} from '@/lib/security/origin';
import {readPrivacyJson} from '@/lib/privacy/request';
import {checkRateLimit} from '@/lib/security/rate-limit';
import {createAdminSupabase} from '@/lib/supabase/admin';
import {assertOpenAIAllowed} from '@/lib/openai/config';
import {analyzePreparedMedia} from '@/lib/ai/prepared-media-engine';
import {platformSchema} from '@/lib/ai/schemas';
export const runtime='nodejs';
export const dynamic='force-dynamic';
type Context={params:Promise<{id:string}>};
const bodySchema=z.object({includeAudio:z.boolean()}).strict();
const claimSchema=z.object({id:z.string().uuid(),verification_id:z.string().uuid(),claimed:z.boolean(),status:z.enum(['processing','completed','failed']),result:z.unknown().optional()});
const respond=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
function failure(error:unknown){
 if(error instanceof SyntaxError)return respond({error:'JSON incorrect.'},400);
 const {status,message}=publicError(error);return respond({error:message},status);
}
function enabled(){if(process.env.MEDIA_AI_ENABLED!=='true')throw new HttpError(503,'L’analyse IA des médias préparés est désactivée.');}
async function jobId(context:Context){const parsed=z.string().uuid().safeParse((await context.params).id);if(!parsed.success)throw new HttpError(400,'Identifiant incorrect.');return parsed.data;}
export async function POST(request:Request,context:Context){
 let active:{user:string;run:string}|undefined;
 const admin=createAdminSupabase;
 try{
  if(!isSameOrigin(request))throw new HttpError(403,'Origine interdite.');
  const {user,client}=await requireUser();enabled();const id=await jobId(context);
  const parsed=bodySchema.safeParse(await readPrivacyJson(request,512));
  if(!parsed.success)throw new HttpError(400,'Demande d’analyse invalide.');
  // La disponibilité est vérifiée avant la réservation, sans exposer la clé.
  assertOpenAIAllowed('text',process.env);assertOpenAIAllowed('vision',process.env);
  if(parsed.data.includeAudio)assertOpenAIAllowed('audio',process.env);
  const {data:profile,error:profileError}=await client.from('users').select('plan').eq('id',user.id).single();
  if(profileError||!profile)throw new HttpError(503,'Profil indisponible.');
  await checkRateLimit(user.id,profile.plan);
  const db=admin();
  const {data:job,error}=await db.from('media_processing_jobs').select('kind,status,result,verification_id').eq('id',id).eq('user_id',user.id).single();
  if(error||!job)throw new HttpError(404,'Préparation introuvable.');
  if(job.status!=='completed')throw new HttpError(409,'La préparation doit être terminée.');
  if(!['video','carousel'].includes(job.kind)||parsed.data.includeAudio&&job.kind!=='video')throw new HttpError(422,'Couverture média incompatible.');
  const source=await db.from('verifications').select('content_text,platform').eq('id',job.verification_id).eq('user_id',user.id).single();
  if(source.error||!source.data)throw new HttpError(503,'Publication source indisponible.');
  const platform=platformSchema.parse(source.data.platform);
  const claimed=await db.rpc('media_ai_claim',{p_user:user.id,p_job:id,p_audio:parsed.data.includeAudio});
  if(claimed.error){
   if(claimed.error.code==='54000')throw new HttpError(429,'Ton quota mensuel est atteint.');
   if(claimed.error.code==='42501')throw new HttpError(403,'Préparation inaccessible.');
   throw new HttpError(503,'Réservation indisponible.');
  }
  const run=claimSchema.parse(claimed.data);
  if(!run.claimed)return respond({status:run.status,verificationId:run.verification_id,...(run.status==='completed'?{result:run.result}:{}),...(run.status==='failed'?{error:'Cette analyse a échoué. Aucune relance payante automatique.'}:{})},run.status==='processing'?202:run.status==='failed'?409:200);
  active={user:user.id,run:run.id};
  const result=await analyzePreparedMedia({userId:user.id,jobId:id,verificationId:run.verification_id,caption:source.data.content_text,platform,kind:job.kind as 'video'|'carousel',result:job.result,includeAudio:parsed.data.includeAudio});
  const finished=await db.rpc('media_ai_finish',{p_user:user.id,p_run:run.id,p_result:result,p_expired:false});
  if(finished.error||finished.data!==true)throw new HttpError(503,'Finalisation indisponible. Consulte l’historique avant toute nouvelle demande.');
  active=undefined;return respond({status:'completed',verificationId:run.verification_id,result});
 }catch(error){
  if(active){const closed=await admin().rpc('media_ai_finish',{p_user:active.user,p_run:active.run,p_result:null,p_expired:false});if(closed.error)console.error('[mentioncheck][media_ai_finish_failed]');}
  return failure(error);
 }
}
export async function GET(_request:Request,context:Context){
 try{
  const {user,client}=await requireUser();enabled();const id=await jobId(context);
  await checkRateLimit(user.id,'solo');
  const job=await client.from('media_processing_jobs').select('id').eq('id',id).eq('user_id',user.id).single();
  if(job.error||!job.data)throw new HttpError(404,'Préparation introuvable.');
  const read=()=>client.from('media_ai_runs').select('id,include_audio,status,verification_id,created_at,completed_at,expires_at').eq('job_id',id).eq('user_id',user.id).order('created_at',{ascending:false});
  let page=await read();if(page.error)throw new HttpError(503,'Historique indisponible.');
  let expired=false;
  for(const run of page.data??[]){
   if(run.status==='processing'&&Date.parse(run.expires_at)<=Date.now()){
    const ended=await createAdminSupabase().rpc('media_ai_finish',{p_user:user.id,p_run:run.id,p_result:null,p_expired:true});
    if(ended.error)throw new HttpError(503,'Historique indisponible.');expired=true;
   }
  }
  if(expired){page=await read();if(page.error)throw new HttpError(503,'Historique indisponible.');}
  return respond({runs:page.data??[]});
 }catch(error){return failure(error);}
}
