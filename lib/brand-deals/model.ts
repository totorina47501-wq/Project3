import { z } from 'zod';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(value+'T00:00:00Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0,10)===value;
}, 'Date invalide.');
export const dealDraftSchema = z.object({
  brand_name:z.string().trim().min(1).max(200),
  start_date:date,
  end_date:date.nullable().default(null),
  contract_url:z.string().min(1).max(500).nullable().default(null),
  verification_ids:z.array(z.string().uuid()).max(50).default([])
    .refine(ids=>new Set(ids).size===ids.length,'Vérifications dupliquées.'),
}).strict().refine(value=>!value.end_date || value.end_date>=value.start_date, {
  message:'La fin doit suivre le début.',path:['end_date'],
});
export type DealDraft = z.infer<typeof dealDraftSchema>;
export const dealListSchema=z.object({
  page:z.coerce.number().int().min(1).max(10000).default(1),
  state:z.enum(['all','draft','archived']).default('all'),
  q:z.string().trim().max(100).regex(/^[\p{L}\p{N}\s.'’&()\-]*$/u).default(''),
});
export const DEAL_PAGE_SIZE=20;
export type DealFilters=z.infer<typeof dealListSchema>;
export type DealRecord={
  id:string;brand_name:string;start_date:string;end_date:string|null;
  contract_url:string|null;created_at:string;archived_at:string|null;hash_sha256:string|null;
  archive_payload?:unknown;
  brand_deal_verifications?:Array<{verification_id:string}>;
};
export const DEAL_COLUMNS='id,brand_name,start_date,end_date,contract_url,created_at,archived_at,hash_sha256,brand_deal_verifications(verification_id)';

export const DEAL_DETAIL_COLUMNS=DEAL_COLUMNS+',archive_payload';

export function assertOwnedContract(userId:string,path:string|null):void {
  if(path===null)return;
  if(!path.startsWith(userId+'/') || !/^[a-zA-Z0-9/_\-.]+$/.test(path) || path.split('/').some(part=>!part || part==='.' || part==='..')) {
    throw new Error('Chemin de contrat privé invalide.');
  }
}
// Le snapshot versionné ne contient que tableaux et scalaires, sans objets.
// Les espaces après virgules reproduisent exactement jsonb::text PostgreSQL.
export type ArchiveValue=string|null|ArchiveValue[];
export function archiveCanonicalText(value:ArchiveValue):string {
  return Array.isArray(value) ? '['+value.map(archiveCanonicalText).join(', ')+']' : JSON.stringify(value);
}
export async function archiveDigest(value:ArchiveValue):Promise<string> {
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(archiveCanonicalText(value)));
  return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
}
type RegistryEntry=Pick<DealRecord,'id'|'brand_name'|'start_date'|'end_date'|'archived_at'|'hash_sha256'>;
export function registryCsv(records:RegistryEntry[]):string {
  const cell=(value:string|null)=>'"'+(value && /^[\s]*[=+\-@\t\r\n]/.test(value)?"'"+value:value??'').replace(/"/g,'""')+'"';
  const rows=[['Registre MentionCheck — Informatif, sans signature qualifiée'],
    ['Identifiant','Marque','Début','Fin','État','Archivage UTC','SHA-256'],
    ...records.map(row=>[row.id,row.brand_name,row.start_date,row.end_date,row.archived_at?'archivé':'brouillon',row.archived_at,row.hash_sha256])];
  return '\uFEFF'+rows.map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n';
}
