import { createAdminSupabase } from '@/lib/supabase/admin';
import { collectPages, listPrivateFiles, ExportLimitError, type ExportPage } from './export';

type ExportUser = { id: string; email?: string | undefined; phone?: string | undefined; created_at?: string; updated_at?: string | undefined; confirmed_at?: string | undefined; last_sign_in_at?: string | undefined; user_metadata?: unknown; app_metadata?: unknown; identities?: Array<{id:string;provider:string;created_at?: string | undefined;updated_at?: string | undefined;last_sign_in_at?: string | undefined;identity_data?: Record<string,unknown> | undefined}> | undefined };
// Aucune sélection * sur les collections : les secrets restent exclus même si le schéma évolue.
// Chaque lecture service_role porte un prédicat propriétaire explicite et non fourni par le navigateur.
export const PERSONAL_COLLECTIONS = [
  ['verifications','verifications','id,user_id,platform,content_text,media_url,media_type,ai_score,ai_risk_level,ai_explanation,ai_rewrite_suggestion,accepted_caption,hash_sha256,prompt_version,status,created_at,completed_at,updated_at','user_id','id'],
  ['conversations','assistant_conversations','id,verification_id,messages,created_at,updated_at','user_id','id'],
  ['deals','brand_deals','id,brand_name,start_date,end_date,contract_url,archived_at,archive_payload,hash_sha256,created_at','user_id','id'],
  ['dealVerifications','brand_deal_verifications','deal_id,verification_id','user_id','deal_id,verification_id'],
  ['subscriptions','subscriptions','id,stripe_subscription_id,plan,status,current_period_end,created_at,updated_at','user_id','id'],
  ['social','social_accounts','id,platform,handle,connection_kind,connected_at','user_id','id'],
  ['preferences','user_preferences','user_id,rewrite_tone,updated_at','user_id','user_id'],
  ['usage','usage_monthly','period_start,checks_used,rewrites_used,mia_messages_used,updated_at','user_id','period_start'],
  ['feedback','rewrite_feedback','id,verification_id,original_caption,accepted_caption,prompt_version,training_consent_snapshot,accepted_at','user_id','id'],
  ['media','media_assets','id,group_id,kind,status,storage_path,mime_type,declared_bytes,actual_bytes,duration_seconds,created_at,completed_at,expires_at','user_id','id'],
  ['metrics','ai_analyses','id,user_id,verification_id,stage,model_used,prompt_tokens,completion_tokens,latency_ms,cost_usd,raw_response,created_at','user_id','id'],
  ['erasureRequests','privacy_erasure_requests','id,status,requested_at,updated_at,cancelled_at','user_id','id'],
  ['consentEvents','privacy_consent_events','id,ai_training_opt_in,source,recorded_at','user_id','id'],
  ['erasureRuns','privacy_erasure_runs','id,request_id,mode,status,summary,created_at','user_id','id'],
  ['workspaces','workspaces','id,name,owner_id,created_at','owner_id','id'],
  ['memberships','workspace_members','workspace_id,user_id,role,joined_at','user_id','workspace_id'],
  ['apiKeys','api_keys','id,workspace_id,created_by,name,prefix,scopes,created_at,expires_at,revoked_at','created_by','id'],
  ['invitationsSent','workspace_invitations','id,workspace_id,email,role,created_by,expires_at,accepted_at,accepted_by,revoked_at,created_at','created_by','id'],
  ['invitationsAccepted','workspace_invitations','id,workspace_id,email,role,created_by,expires_at,accepted_at,accepted_by,revoked_at,created_at','accepted_by','id'],
  ['workspaceVerifications','workspace_verifications','id,workspace_id,created_by,platform,caption,result,created_at','created_by','id'],
] as const;
const MEDIA_JOB_COLLECTIONS = [
  ['mediaJobs','media_processing_jobs','id,verification_id,kind,status,attempts,failure_code,result,created_at,updated_at,completed_at','user_id','id'],
  ['mediaJobInputs','media_processing_inputs','job_id,asset_id,position','user_id','job_id,position'],
] as const;

export async function readPersonalData(user: ExportUser) {
  const admin = createAdminSupabase();
  const profile = await admin.from('users')
    .select('id,email,plan,stripe_customer_id,ai_training_opt_in,created_at,updated_at')
    .eq('id',user.id).single();
  if (profile.error || !profile.data) throw new Error('Profil indisponible.');
  const collections: Record<string, unknown[]> = {};
  let bytes = 0;
  const collectionsToRead = [...PERSONAL_COLLECTIONS,
    ...(process.env.MEDIA_JOBS_SCHEMA_READY === 'true' ? MEDIA_JOB_COLLECTIONS : []),
    ...(process.env.MEDIA_AI_SCHEMA_READY === 'true' ? [['mediaAiRuns','media_ai_runs','id,job_id,verification_id,include_audio,status,quota_period,result,created_at,expires_at,completed_at','user_id','id'] as const] : [])];
  for (const [name, table, fields, ownerColumn, orderColumns] of collectionsToRead) {
    collections[name] = await collectPages(async (offset, size) => {
      let query = admin.from(table).select(fields, {count:'exact'}).eq(ownerColumn,user.id);
      for (const column of orderColumns.split(',')) query = query.order(column,{ascending:true});
      const page = await query.range(offset,offset+size-1);
      bytes += new TextEncoder().encode(JSON.stringify(page.data)).length;
      if (bytes > 25 * 1024 * 1024) throw new ExportLimitError();
      return page as ExportPage<unknown>;
    });
  }
  if (user.email) {
    collections.invitationsReceived = await collectPages(async(offset,size)=>
      await admin.from('workspace_invitations')
        .select('id,workspace_id,email,role,created_by,expires_at,accepted_at,accepted_by,revoked_at,created_at',{count:'exact'})
        .eq('email',user.email!.toLowerCase()).order('id',{ascending:true}).range(offset,offset+size-1));
  }
  const privateFiles = [];
  for (const bucket of ['verification-media','deal-contracts','verification-media-derived']) {
    privateFiles.push(...await listPrivateFiles(bucket,user.id,(prefix,offset)=>
      admin.storage.from(bucket).list(prefix,{limit:1000,offset,sortBy:{column:'name',order:'asc'}})));
  }
  const payload = {
    schemaVersion:'2026-11-04',exportedAt:new Date().toISOString(),
    auth: {
      id:user.id,email:user.email ?? null,phone:user.phone ?? null,
      created_at:user.created_at ?? null,updated_at:user.updated_at ?? null,
      confirmed_at:user.confirmed_at ?? null,last_sign_in_at:user.last_sign_in_at ?? null,
      user_metadata:user.user_metadata ?? {},app_metadata:user.app_metadata ?? {},
      identities:(user.identities ?? []).map(identity=>({
        id:identity.id,provider:identity.provider,created_at:identity.created_at ?? null,
        updated_at:identity.updated_at ?? null,last_sign_in_at:identity.last_sign_in_at ?? null,
        profile:Object.fromEntries(['email','email_verified','phone_verified','name','full_name','avatar_url','picture','sub','provider_id']
          .filter(key=>identity.identity_data?.[key] !== undefined).map(key=>[key,identity.identity_data?.[key]])),
      })),
    },
    profile:profile.data,collections,privateFiles,
    information: {
      structuredDataComplete:true,isComplete:false,
      excluded:['private_file_bytes','passwords_and_tokens','auth_security_metadata','provider_logs_and_backups','provider_held_data','other_members_private_history'],
      note:'Toutes les pages des collections annoncées sont lues. Le manifeste inventorie les fichiers privés de ce compte sans URL signée. Les octets, secrets, sauvegardes, journaux et données détenues par les prestataires sont exclus ; une extraction accompagnée peut être nécessaire. Les lectures ne constituent pas un instantané transactionnel : éviter les modifications pendant l’export.',
    },
  };
  if (new TextEncoder().encode(JSON.stringify(payload)).length > 25 * 1024 * 1024) throw new ExportLimitError();
  return payload;
}
