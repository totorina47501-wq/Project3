// Contrat pur, hors réseau. L'entrée est une unique ligne media_assets lue côté serveur.
// La validation n'est PAS une preuve qu'une ligne provient de la base : le caller doit
// la récupérer avec RLS/service_role et vérifier l'owner sur cette même ligne.
import { createHash } from 'node:crypto';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA=/^[a-f0-9]{64}$/;
const PATH=/^([a-f0-9-]{36})\/([a-f0-9-]{36})\.(mp4|mov)$/i;
export const MAX_ATTEMPTS=3;
export const LEASE_MS=5*60*1000;
export const MAX_VIDEO_BYTES=50*1024*1024;
function instant(now){
  if(!(now instanceof Date)||!Number.isFinite(now.getTime()))throw new Error('Horodatage de job invalide');
  return now.getTime();
}

/**
 * Reçoit UNIQUEMENT les colonnes d'une même ligne public.media_assets :
 * id, user_id, storage_path, media_sha256, status, kind, mime_type,
 * actual_bytes, expires_at. Ne jamais assembler ces champs depuis le client.
 * Aucune queue, requête Storage, FFmpeg ou IA n'est lancée ici.
 */
export function createVideoJob(row,now=new Date()){
  const t=instant(now);
  if(!row||typeof row!=='object'||!UUID.test(row.id)||!UUID.test(row.user_id)||
    !SHA.test(row.media_sha256)||row.status!=='ready'||row.kind!=='video'||
    !Number.isSafeInteger(row.actual_bytes)||row.actual_bytes<1||
    row.actual_bytes>MAX_VIDEO_BYTES||!Number.isFinite(Date.parse(row.expires_at))||
    Date.parse(row.expires_at)<=t)
    throw new Error('Job vidéo invalide ou média non confirmé');
  const matched=PATH.exec(row.storage_path??'');
  if(!matched||!UUID.test(matched[1])||!UUID.test(matched[2])||
    matched[1].toLowerCase()!==row.user_id.toLowerCase()||
    (matched[3].toLowerCase()==='mp4'?'video/mp4':'video/quicktime')!==row.mime_type)
    throw new Error('Chemin privé ou MIME vidéo invalide');
  // Le nom du fichier Storage et media_assets.id sont générés séparément.
  // Il serait incorrect d'exiger l'égalité ; la liaison vient de la ligne DB.
  const assetId=row.id.toLowerCase();
  const sha256=row.media_sha256;
  const key=createHash('sha256').update(assetId+':'+sha256).digest('hex');
  return Object.freeze({schemaVersion:1,key,assetId,userId:row.user_id.toLowerCase(),
    sha256,state:'queued',attempts:0,createdAt:now.toISOString(),
    leaseUntil:null,leaseToken:null,aiCalls:0});
}

/**
 * Transition locale stricte. Le jeton de bail est généré et conservé par un
 * futur service fiable ; le claim CAS atomique DB et la contrainte UNIQUE(key)
 * doivent être mis en place AVANT activation. Ce helper ne les remplace pas.
 */
export function nextJobState(job,event,now=new Date(),token=null){
  const t=instant(now);
  if(!job||!SHA.test(job.key)||!UUID.test(job.assetId)||
    !Number.isSafeInteger(job.attempts)||job.attempts<0||
    job.attempts>MAX_ATTEMPTS||job.aiCalls!==0)
    throw new Error('État de job invalide');
  if(event==='claim'&&job.state==='queued'&&job.attempts<MAX_ATTEMPTS&&
    UUID.test(token)&&job.leaseToken===null&&job.leaseUntil===null)
    return {...job,state:'processing',attempts:job.attempts+1,
      leaseToken:token.toLowerCase(),
      leaseUntil:new Date(t+LEASE_MS).toISOString()};
  if(job.state==='processing'){
    const deadline=Date.parse(job.leaseUntil);
    if(!Number.isFinite(deadline)||!UUID.test(job.leaseToken))
      throw new Error('Lease vidéo invalide');
    if(event==='timeout'&&deadline<=t)
      return {...job,state:job.attempts>=MAX_ATTEMPTS?'failed':'queued',
        leaseUntil:null,leaseToken:null};
    if((event==='success'||event==='failure')&&
      token===job.leaseToken&&deadline>t){
      return {...job,state:event==='success'?'extracted':
        job.attempts>=MAX_ATTEMPTS?'failed':'queued',
        leaseUntil:null,leaseToken:null};
    }
  }
  throw new Error('Transition de job refusée');
}
